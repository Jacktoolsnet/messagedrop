const express = require('express');
const OpenAI = require('openai');

const tableAiSettings = require('../db/tableAiSettings');
const tableAiUsageEvent = require('../db/tableAiUsageEvent');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');

const router = express.Router();

const AI_ROLES = ['author', 'editor', 'admin', 'root'];
const DEFAULT_ADMIN_MODEL = 'gpt-5.4';
const DEFAULT_HASHTAG_COUNT = 8;
const MAX_TEXT_LENGTH = 12_000;
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_IN_SECONDS = 24 * 60 * 60;
const DAY_IN_MS = DAY_IN_SECONDS * 1000;
const TOOL_TYPES = new Set(['proofread', 'rewrite', 'translate', 'hashtags', 'emoji', 'thread', 'quality_check']);
const REWRITE_GOALS = new Set(['clearer', 'friendlier', 'shorter', 'more_formal', 'more_engaging']);

let modelCache = {
  expiresAt: 0,
  rows: []
};

router.use(requireAdminJwt);
router.use(requireRole(...AI_ROLES));

router.get('/settings', async (req, res, next) => {
  try {
    const row = await getAiSettings(req.database.db);
    res.status(200).json({
      status: 200,
      row: decorateSettings(row)
    });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const selectedModel = normalizeModelId(req.body?.selectedModel);
    if (!selectedModel) {
      throw apiError.unprocessableEntity('selected_model_required');
    }
    const monthlyBudgetUsd = normalizeBudgetUsd(req.body?.monthlyBudgetUsd);

    await upsertAiSettings(req.database.db, {
      selectedModel,
      monthlyBudgetUsd,
      updatedAt: Date.now()
    });

    const row = await getAiSettings(req.database.db);
    res.status(200).json({
      status: 200,
      row: decorateSettings(row)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/models', async (req, res, next) => {
  try {
    const forceRefresh = req.query?.force === '1' || req.query?.force === 'true';
    const settings = await getAiSettings(req.database.db);
    const selectedModel = resolveEffectiveModel(settings?.selectedModel);
    const rows = await listAvailableModels({
      selectedModel,
      forceRefresh
    });

    res.status(200).json({
      status: 200,
      configured: isOpenAiConfigured(),
      selectedModel,
      defaultModel: resolveDefaultModel(),
      rows
    });
  } catch (error) {
    next(error);
  }
});

router.get('/usage', async (req, res, next) => {
  try {
    const settings = await getAiSettings(req.database.db);
    const row = await getUsageSummary(settings, req.database.db);
    res.status(200).json({
      status: 200,
      row
    });
  } catch (error) {
    next(normalizeOpenAiError(error));
  }
});

router.post('/apply', async (req, res, next) => {
  try {
    if (!isOpenAiConfigured()) {
      throw apiError.serviceUnavailable('openai_not_configured');
    }

    const payload = normalizeToolPayload(req.body);
    const settings = await getAiSettings(req.database.db);
    const model = resolveEffectiveModel(settings?.selectedModel);
    const client = createOpenAiClient();
    const result = await runAiTool(client, model, payload, req.database.db);

    res.status(200).json({
      status: 200,
      result
    });
  } catch (error) {
    next(normalizeOpenAiError(error));
  }
});

function createOpenAiClient() {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw apiError.serviceUnavailable('openai_not_configured');
  }

  return new OpenAI({
    apiKey,
    organization: process.env.OPENAI_ORG_ID || undefined,
    project: process.env.OPENAI_PROJECT_ID || undefined
  });
}

function isOpenAiConfigured() {
  return !!getOpenAiApiKey();
}

function getOpenAiApiKey() {
  const contentCreationKey = typeof process.env.OPENAI_API_KEY_CONTENT_CREATION === 'string'
    ? process.env.OPENAI_API_KEY_CONTENT_CREATION.trim()
    : '';
  if (contentCreationKey) {
    return contentCreationKey;
  }

  const fallbackKey = typeof process.env.OPENAI_API_KEY === 'string'
    ? process.env.OPENAI_API_KEY.trim()
    : '';
  return fallbackKey || '';
}

function getOpenAiUsageKeyConfig() {
  const adminKey = typeof process.env.OPENAI_API_KEY_ADMIN === 'string'
    ? process.env.OPENAI_API_KEY_ADMIN.trim()
    : '';
  if (adminKey) {
    return {
      apiKey: adminKey,
      source: 'admin'
    };
  }

  const fallbackKey = getOpenAiApiKey();
  if (fallbackKey) {
    return {
      apiKey: fallbackKey,
      source: 'standard'
    };
  }

  return {
    apiKey: '',
    source: 'none'
  };
}

function resolveDefaultModel() {
  const configured = normalizeModelId(process.env.OPENAI_ADMIN_MODEL);
  return configured || DEFAULT_ADMIN_MODEL;
}

function resolveEffectiveModel(selectedModel) {
  return normalizeModelId(selectedModel) || resolveDefaultModel();
}

function normalizeModelId(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  return normalized.slice(0, 120);
}

function getAiSettings(db) {
  return new Promise((resolve, reject) => {
    tableAiSettings.get(db, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row || { selectedModel: '', updatedAt: 0 });
    });
  });
}

function upsertAiSettings(db, payload) {
  return new Promise((resolve, reject) => {
    tableAiSettings.upsert(db, payload, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function decorateSettings(row) {
  const selectedModel = resolveEffectiveModel(row?.selectedModel);
  return {
    selectedModel,
    defaultModel: resolveDefaultModel(),
    monthlyBudgetUsd: normalizeBudgetUsd(row?.monthlyBudgetUsd),
    updatedAt: Number(row?.updatedAt || 0),
    apiConfigured: isOpenAiConfigured()
  };
}

function normalizeBudgetUsd(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, Math.min(1_000_000, Math.round(parsed * 100) / 100));
}

async function listAvailableModels({ selectedModel, forceRefresh = false }) {
  const defaultModel = resolveDefaultModel();
  const fallbackRows = buildFallbackModelRows(selectedModel, defaultModel);
  if (!isOpenAiConfigured()) {
    return fallbackRows;
  }

  const now = Date.now();
  if (!forceRefresh && modelCache.expiresAt > now && Array.isArray(modelCache.rows) && modelCache.rows.length > 0) {
    return mergePinnedModels(modelCache.rows, selectedModel, defaultModel);
  }

  const client = createOpenAiClient();
  const page = await client.models.list();
  const sourceRows = Array.isArray(page?.data) ? page.data : [];

  const rows = sourceRows
    .filter((row) => shouldExposeModel(row?.id))
    .map((row) => ({
      id: String(row?.id || '').trim(),
      createdAt: Number.isFinite(Number(row?.created)) ? Number(row.created) * 1000 : null,
      ownedBy: typeof row?.owned_by === 'string' ? row.owned_by : '',
      available: true
    }))
    .filter((row) => row.id)
    .sort((left, right) => right.id.localeCompare(left.id));

  modelCache = {
    expiresAt: now + MODEL_CACHE_TTL_MS,
    rows
  };

  return mergePinnedModels(rows, selectedModel, defaultModel);
}

function shouldExposeModel(modelId) {
  const normalized = String(modelId || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const excludedFragments = [
    'audio',
    'computer-use',
    'embedding',
    'image',
    'moderation',
    'omni-moderation',
    'realtime',
    'search',
    'speech',
    'transcribe',
    'tts',
    'video',
    'vision',
    'whisper'
  ];

  if (excludedFragments.some((fragment) => normalized.includes(fragment))) {
    return false;
  }

  if (normalized.includes('codex')) {
    return false;
  }

  return normalized.startsWith('gpt-') || /^o\d/i.test(normalized) || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4');
}

function buildFallbackModelRows(selectedModel, defaultModel) {
  const ids = Array.from(new Set([selectedModel, defaultModel].filter(Boolean)));
  return ids.map((id) => ({
    id,
    createdAt: null,
    ownedBy: 'openai',
    available: false,
    isSelected: id === selectedModel,
    isDefault: id === defaultModel
  }));
}

function mergePinnedModels(rows, selectedModel, defaultModel) {
  const byId = new Map();
  for (const row of rows) {
    byId.set(row.id, {
      ...row,
      isSelected: row.id === selectedModel,
      isDefault: row.id === defaultModel
    });
  }

  for (const id of [selectedModel, defaultModel]) {
    if (!id || byId.has(id)) {
      continue;
    }
    byId.set(id, {
      id,
      createdAt: null,
      ownedBy: 'openai',
      available: false,
      isSelected: id === selectedModel,
      isDefault: id === defaultModel
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (left.isSelected && !right.isSelected) {
      return -1;
    }
    if (!left.isSelected && right.isSelected) {
      return 1;
    }
    if (left.isDefault && !right.isDefault) {
      return -1;
    }
    if (!left.isDefault && right.isDefault) {
      return 1;
    }
    return right.id.localeCompare(left.id);
  });
}

async function getUsageSummary(settings, db) {
  const monthlyBudgetUsd = normalizeBudgetUsd(settings?.monthlyBudgetUsd);
  const usageKeyConfig = getOpenAiUsageKeyConfig();

  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);
  const todayStartSeconds = Math.floor(startOfUtcDay(now) / 1000);
  const currentMonthStartSeconds = Math.floor(startOfUtcMonth(now) / 1000);
  const last7DaysStartSeconds = Math.max(0, todayStartSeconds - (6 * DAY_IN_SECONDS));
  const [localToday, localLast7Days, localCurrentMonth] = await Promise.all([
    getLocalUsageWindow(db, todayStartSeconds * 1000, now),
    getLocalUsageWindow(db, last7DaysStartSeconds * 1000, now),
    getLocalUsageWindow(db, currentMonthStartSeconds * 1000, now)
  ]);

  if (!usageKeyConfig.apiKey) {
    return buildUnavailableUsageSummary({
      monthlyBudgetUsd,
      now,
      message: 'OpenAI API not configured. Showing locally tracked editorial AI token usage only.',
      localUsage: {
        today: localToday,
        last7Days: localLast7Days,
        currentMonth: localCurrentMonth
      }
    });
  }

  try {
    const [usagePages, monthCostsPage] = await Promise.all([
      fetchOrganizationUsagePages(usageKeyConfig.apiKey, {
        start_time: currentMonthStartSeconds,
        end_time: nowSeconds,
        bucket_width: '1d',
        limit: 31
      }),
      fetchOpenAiOrganizationJson('/v1/organization/costs', {
        start_time: currentMonthStartSeconds,
        end_time: nowSeconds,
        bucket_width: '1d',
        limit: 31
      }, usageKeyConfig.apiKey)
    ]);

    const currentMonthUsage = chooseUsageSummary(
      summarizeUsageBuckets(usagePages, currentMonthStartSeconds * 1000, now),
      localCurrentMonth
    );
    const todayUsage = chooseUsageSummary(
      summarizeUsageBuckets(filterBucketsByStart(usagePages, todayStartSeconds), todayStartSeconds * 1000, now),
      localToday
    );
    const last7DaysUsage = chooseUsageSummary(
      summarizeUsageBuckets(filterBucketsByStart(usagePages, last7DaysStartSeconds), last7DaysStartSeconds * 1000, now),
      localLast7Days
    );

    const currentMonthCosts = summarizeCostBuckets(monthCostsPage?.data, currentMonthStartSeconds * 1000, now);
    const todayCosts = summarizeCostBuckets(filterBucketsByStart(monthCostsPage?.data, todayStartSeconds), todayStartSeconds * 1000, now);
    const last7DaysCosts = summarizeCostBuckets(filterBucketsByStart(monthCostsPage?.data, last7DaysStartSeconds), last7DaysStartSeconds * 1000, now);

    const currentMonth = attachSpendToUsage(currentMonthUsage, currentMonthCosts);
    const today = attachSpendToUsage(todayUsage, todayCosts);
    const last7Days = attachSpendToUsage(last7DaysUsage, last7DaysCosts);
    const budgetConfigured = monthlyBudgetUsd > 0;
    const remainingBudgetUsd = budgetConfigured
      ? Math.round((monthlyBudgetUsd - currentMonth.spend.value) * 100) / 100
      : null;

    return {
      usageAvailable: true,
      costsAvailable: true,
      usageSource: currentMonthUsage.source === 'local' ? 'local' : 'organization',
      costsSource: 'organization',
      requiresAdminKey: usageKeyConfig.source !== 'admin',
      keySource: usageKeyConfig.source,
      budgetConfigured,
      monthlyBudgetUsd,
      remainingBudgetUsd,
      currency: currentMonth.spend.currency,
      today,
      last7Days,
      currentMonth,
      updatedAt: now,
      message: buildUsageMessage({
        usageKeySource: usageKeyConfig.source,
        usedLocalFallback: currentMonthUsage.source === 'local',
        localHasData: localCurrentMonth.totalTokens > 0
      })
    };
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      return buildUnavailableUsageSummary({
        monthlyBudgetUsd,
        now,
        requiresAdminKey: true,
        message: 'OpenAI usage and cost endpoints require an organization admin key. Showing locally tracked editorial AI token usage only.',
        localUsage: {
          today: localToday,
          last7Days: localLast7Days,
          currentMonth: localCurrentMonth
        }
      });
    }

    if (error?.status === 404) {
      return buildUnavailableUsageSummary({
        monthlyBudgetUsd,
        now,
        requiresAdminKey: true,
        message: 'OpenAI usage endpoints are not available for the configured key. Showing locally tracked editorial AI token usage only.',
        localUsage: {
          today: localToday,
          last7Days: localLast7Days,
          currentMonth: localCurrentMonth
        }
      });
    }

    throw error;
  }
}

function buildUnavailableUsageSummary({
  monthlyBudgetUsd = 0,
  requiresAdminKey = false,
  message = 'OpenAI usage data is currently unavailable.',
  now = Date.now(),
  localUsage = null
} = {}) {
  const budgetConfigured = monthlyBudgetUsd > 0;
  const today = localUsage?.today || emptyUsageWindow(startOfUtcDay(now), now);
  const last7Days = localUsage?.last7Days || emptyUsageWindow(now - (7 * DAY_IN_MS), now);
  const currentMonth = localUsage?.currentMonth || emptyUsageWindow(startOfUtcMonth(now), now);

  return {
    usageAvailable: (today.totalTokens + last7Days.totalTokens + currentMonth.totalTokens) > 0,
    costsAvailable: false,
    usageSource: currentMonth.totalTokens > 0 ? 'local' : 'unavailable',
    costsSource: 'unavailable',
    requiresAdminKey,
    keySource: getOpenAiUsageKeyConfig().source,
    budgetConfigured,
    monthlyBudgetUsd,
    remainingBudgetUsd: budgetConfigured ? monthlyBudgetUsd : null,
    currency: 'USD',
    today,
    last7Days,
    currentMonth,
    updatedAt: now,
    message
  };
}

function startOfUtcDay(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcMonth(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

function filterBucketsByStart(buckets, startSeconds) {
  if (!Array.isArray(buckets)) {
    return [];
  }
  return buckets.filter((bucket) => Number(bucket?.start_time || 0) >= startSeconds);
}

function emptyUsageWindow(startTime, endTime) {
  return {
    startTime: Number(startTime) || 0,
    endTime: Number(endTime) || 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    requests: 0,
    totalTokens: 0,
    spend: {
      value: 0,
      currency: 'USD'
    }
  };
}

function summarizeUsageBuckets(buckets, fallbackStartTime, fallbackEndTime) {
  const summary = emptyUsageWindow(fallbackStartTime, fallbackEndTime);
  const normalizedBuckets = normalizeBucketList(buckets);
  if (!normalizedBuckets.length) {
    return summary;
  }

  for (const bucket of normalizedBuckets) {
    const bucketStartTime = Number(bucket?.start_time || 0) * 1000;
    const bucketEndTime = Number(bucket?.end_time || 0) * 1000;
    if (bucketStartTime > 0 && (!summary.startTime || bucketStartTime < summary.startTime)) {
      summary.startTime = bucketStartTime;
    }
    if (bucketEndTime > 0 && bucketEndTime > summary.endTime) {
      summary.endTime = bucketEndTime;
    }

    const results = normalizeBucketResults(bucket);
    for (const result of results) {
      summary.inputTokens += toPositiveNumber(result?.input_tokens);
      summary.outputTokens += toPositiveNumber(result?.output_tokens);
      summary.cachedInputTokens += toPositiveNumber(result?.input_cached_tokens);
      summary.reasoningTokens += toPositiveNumber(result?.output_tokens_details?.reasoning_tokens);
      summary.requests += toPositiveNumber(result?.num_model_requests);
    }
  }

  summary.totalTokens = summary.inputTokens + summary.outputTokens;
  return summary;
}

function summarizeCostBuckets(buckets, fallbackStartTime, fallbackEndTime) {
  const summary = {
    startTime: Number(fallbackStartTime) || 0,
    endTime: Number(fallbackEndTime) || 0,
    value: 0,
      currency: 'USD'
  };

  const normalizedBuckets = normalizeBucketList(buckets);
  if (!normalizedBuckets.length) {
    return summary;
  }

  for (const bucket of normalizedBuckets) {
    const bucketStartTime = Number(bucket?.start_time || 0) * 1000;
    const bucketEndTime = Number(bucket?.end_time || 0) * 1000;
    if (bucketStartTime > 0 && (!summary.startTime || bucketStartTime < summary.startTime)) {
      summary.startTime = bucketStartTime;
    }
    if (bucketEndTime > 0 && bucketEndTime > summary.endTime) {
      summary.endTime = bucketEndTime;
    }

    const results = normalizeBucketResults(bucket);
    for (const result of results) {
      const amountValue = Number(result?.amount?.value);
      if (Number.isFinite(amountValue)) {
        summary.value += amountValue;
      }

      const currency = typeof result?.amount?.currency === 'string'
        ? result.amount.currency.trim().toLowerCase()
        : '';
      if (currency) {
        summary.currency = currency.toUpperCase();
      }
    }
  }

  summary.value = Math.round(summary.value * 10000) / 10000;
  return summary;
}

function attachSpendToUsage(usageSummary, costSummary) {
  return {
    ...usageSummary,
    spend: {
      value: Math.round(Number(costSummary?.value || 0) * 100) / 100,
      currency: typeof costSummary?.currency === 'string' && costSummary.currency
        ? String(costSummary.currency).toUpperCase()
        : 'USD'
    }
  };
}

function normalizeBucketList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function normalizeBucketResults(bucket) {
  if (Array.isArray(bucket?.results)) {
    return bucket.results;
  }
  if (Array.isArray(bucket?.result)) {
    return bucket.result;
  }
  if (bucket?.result && typeof bucket.result === 'object') {
    return [bucket.result];
  }
  return [];
}

function chooseUsageSummary(remoteSummary, localSummary) {
  if (!localSummary || localSummary.totalTokens <= 0) {
    return {
      ...remoteSummary,
      source: 'remote'
    };
  }

  if ((remoteSummary?.totalTokens || 0) <= 0) {
    return {
      ...localSummary,
      source: 'local'
    };
  }

  return {
    ...remoteSummary,
    source: 'remote'
  };
}

function buildUsageMessage({ usageKeySource, usedLocalFallback, localHasData }) {
  const messages = [];
  if (usageKeySource !== 'admin') {
    messages.push('Usage and costs loaded without a dedicated organization admin key. If this stops working, set OPENAI_API_KEY_ADMIN.');
  }
  if (usedLocalFallback) {
    messages.push('Token usage is currently shown from locally tracked editorial AI calls.');
  } else if (localHasData) {
    messages.push('Local editorial AI usage tracking is active as a fallback.');
  }
  return messages.join(' ');
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

async function fetchOrganizationUsagePages(apiKey, query) {
  const paths = [
    '/v1/organization/usage/completions',
    '/v1/organization/usage/responses'
  ];

  const settled = await Promise.allSettled(paths.map((path) => fetchOpenAiOrganizationJson(path, query, apiKey)));
  const pages = [];
  let firstFailure = null;

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      pages.push(result.value);
      continue;
    }

    const error = result.reason;
    if (error?.status === 404) {
      continue;
    }
    if (!firstFailure) {
      firstFailure = error;
    }
  }

  if (pages.length > 0) {
    return pages.flatMap((page) => Array.isArray(page?.data) ? page.data : []);
  }

  if (firstFailure) {
    throw firstFailure;
  }

  return [];
}

function getLocalUsageWindow(db, startTime, endTime) {
  return new Promise((resolve, reject) => {
    tableAiUsageEvent.sumRange(db, { startTime, endTime }, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        startTime,
        endTime,
        inputTokens: toPositiveNumber(row?.inputTokens),
        outputTokens: toPositiveNumber(row?.outputTokens),
        cachedInputTokens: toPositiveNumber(row?.cachedInputTokens),
        reasoningTokens: toPositiveNumber(row?.reasoningTokens),
        requests: toPositiveNumber(row?.requestCount),
        totalTokens: toPositiveNumber(row?.totalTokens),
        spend: {
          value: 0,
          currency: 'USD'
        }
      });
    });
  });
}

async function fetchOpenAiOrganizationJson(path, query, apiKey) {
  const url = new URL(`https://api.openai.com${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw ? { message: raw } : null;
  }

  if (!response.ok) {
    const err = apiError.fromStatus(response.status, payload?.message || payload?.error || 'openai_request_failed');
    err.detail = payload;
    throw err;
  }

  return payload;
}

function normalizeToolPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw apiError.badRequest('invalid_ai_request');
  }

  const tool = String(value.tool || '').trim();
  if (!TOOL_TYPES.has(tool)) {
    throw apiError.badRequest('unsupported_ai_tool');
  }

  const text = normalizeText(value.text);
  const locationLabel = normalizeShortText(value.locationLabel, 200);
  const publicProfileName = normalizeShortText(value.publicProfileName, 120);
  const parentLabel = normalizeShortText(value.parentLabel, 200);
  const existingHashtags = normalizeHashtagList(value.existingHashtags);
  const contentType = String(value.contentType || 'public').trim() === 'comment' ? 'comment' : 'public';
  const targetLanguage = normalizeShortText(value.targetLanguage, 60) || 'English';
  const rewriteGoal = normalizeRewriteGoal(value.rewriteGoal);
  const hashtagCount = normalizeHashtagCount(value.hashtagCount);
  const multimedia = normalizeMultimediaSummary(value.multimedia);

  if (tool !== 'hashtags' && !text) {
    throw apiError.unprocessableEntity('text_required_for_ai_tool');
  }

  if (tool === 'hashtags' && !text && !locationLabel && !multimedia.title && !multimedia.description) {
    throw apiError.unprocessableEntity('not_enough_context_for_hashtags');
  }

  return {
    tool,
    text,
    locationLabel,
    publicProfileName,
    parentLabel,
    existingHashtags,
    contentType,
    targetLanguage,
    rewriteGoal,
    hashtagCount,
    multimedia
  };
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim();
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw apiError.unprocessableEntity('text_too_long_for_ai_tool');
  }
  return normalized;
}

function normalizeShortText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function normalizeRewriteGoal(value) {
  const normalized = normalizeShortText(value, 40) || 'clearer';
  return REWRITE_GOALS.has(normalized) ? normalized : 'clearer';
}

function normalizeHashtagCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_HASHTAG_COUNT;
  }
  return Math.max(3, Math.min(DEFAULT_HASHTAG_COUNT, Math.floor(parsed)));
}

function normalizeHashtagList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set();
  const result = [];
  for (const entry of input) {
    const normalized = normalizeHashtagToken(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result.slice(0, DEFAULT_HASHTAG_COUNT);
}

function normalizeHashtagToken(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value)
    .trim()
    .replace(/^#+/, '')
    .normalize('NFKC')
    .toLowerCase();

  if (!normalized || !/^[\p{L}\p{N}_]{2,32}$/u.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeMultimediaSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      type: '',
      title: '',
      description: ''
    };
  }

  return {
    type: normalizeShortText(value.type, 40),
    title: normalizeShortText(value.title, 240),
    description: normalizeShortText(value.description, 500)
  };
}

async function runAiTool(client, model, payload, db) {
  switch (payload.tool) {
    case 'proofread':
      return runProofread(client, model, payload, db);
    case 'rewrite':
      return runRewrite(client, model, payload, db);
    case 'translate':
      return runTranslate(client, model, payload, db);
    case 'hashtags':
      return runHashtagGeneration(client, model, payload, db);
    case 'emoji':
      return runEmojiSuggestions(client, model, payload, db);
    case 'thread':
      return runThreadSuggestions(client, model, payload, db);
    case 'quality_check':
      return runQualityCheck(client, model, payload, db);
    default:
      throw apiError.badRequest('unsupported_ai_tool');
  }
}

async function runProofread(client, model, payload, db) {
  const response = await client.responses.create({
    model,
    instructions: [
      'You are an editorial assistant for short public social messages and comments.',
      'Correct spelling, grammar and punctuation only.',
      'Do not change the meaning.',
      'Keep hashtags, usernames, URLs, emojis and line breaks when possible.',
      'Return only the corrected text without commentary.'
    ].join(' '),
    input: buildEditorialInput(payload)
  });
  await recordResponseUsage(db, 'proofread', model, response);

  const text = String(response.output_text || '').trim();
  if (!text) {
    throw apiError.badGateway('ai_empty_response');
  }

  return {
    tool: 'proofread',
    model,
    text
  };
}

async function runTranslate(client, model, payload, db) {
  const response = await client.responses.create({
    model,
    instructions: [
      `Translate the user provided public message or comment into ${payload.targetLanguage}.`,
      'Preserve meaning, tone, hashtags, usernames, URLs, emojis and line breaks when possible.',
      'Return only the translated text without commentary.'
    ].join(' '),
    input: buildEditorialInput(payload)
  });
  await recordResponseUsage(db, 'translate', model, response);

  const text = String(response.output_text || '').trim();
  if (!text) {
    throw apiError.badGateway('ai_empty_response');
  }

  return {
    tool: 'translate',
    model,
    text,
    targetLanguage: payload.targetLanguage
  };
}

async function runRewrite(client, model, payload, db) {
  const response = await client.responses.create({
    model,
    instructions: [
      `Create 3 distinct rewrite suggestions for a short public ${payload.contentType === 'comment' ? 'comment' : 'message'}.`,
      `Goal: ${rewriteGoalLabel(payload.rewriteGoal)}.`,
      'Keep the core facts intact.',
      'Keep hashtags, usernames, URLs and emojis when useful.',
      'Return only a JSON array with exactly 3 strings and no surrounding explanation.'
    ].join(' '),
    input: buildEditorialInput(payload)
  });
  await recordResponseUsage(db, 'rewrite', model, response);

  const suggestions = parseStringArray(response.output_text, 3).slice(0, 3);
  if (suggestions.length === 0) {
    throw apiError.badGateway('ai_empty_response');
  }

  return {
    tool: 'rewrite',
    model,
    rewriteGoal: payload.rewriteGoal,
    suggestions
  };
}

async function runHashtagGeneration(client, model, payload, db) {
  const response = await client.responses.create({
    model,
    instructions: [
      `Generate up to ${payload.hashtagCount} publication-ready hashtags for the provided content.`,
      'Base them on the text and available context.',
      'Prefer concise, relevant tags over generic ones.',
      'Return only a JSON array of lowercase hashtag tokens without the leading #.',
      'Only use letters, numbers and underscores.',
      'Avoid duplicates and avoid tags longer than 32 characters.'
    ].join(' '),
    input: buildEditorialInput(payload, { includeHashtagContext: true })
  });
  await recordResponseUsage(db, 'hashtags', model, response);

  const hashtags = parseStringArray(response.output_text, payload.hashtagCount)
    .map((entry) => normalizeHashtagToken(entry))
    .filter(Boolean);
  const unique = Array.from(new Set(hashtags)).slice(0, payload.hashtagCount);

  if (unique.length === 0) {
    throw apiError.badGateway('ai_empty_response');
  }

  return {
    tool: 'hashtags',
    model,
    hashtags: unique
  };
}

async function runEmojiSuggestions(client, model, payload, db) {
  const response = await client.responses.create({
    model,
    instructions: [
      'Suggest exactly 6 emoji candidates for the provided short public message or comment.',
      'Return only a JSON array of short strings.',
      'Each array item must contain 1 to 3 emojis and nothing else.',
      'Avoid duplicates and keep the suggestions publication-friendly.'
    ].join(' '),
    input: buildEditorialInput(payload)
  });
  await recordResponseUsage(db, 'emoji', model, response);

  const emojiSuggestions = parseStringArray(response.output_text, 6)
    .map((entry) => normalizeEmojiSuggestion(entry))
    .filter(Boolean);
  const unique = Array.from(new Set(emojiSuggestions)).slice(0, 6);

  if (unique.length === 0) {
    throw apiError.badGateway('ai_empty_response');
  }

  return {
    tool: 'emoji',
    model,
    emojiSuggestions: unique
  };
}

async function runThreadSuggestions(client, model, payload, db) {
  const response = await client.responses.create({
    model,
    instructions: [
      `Create 3 short follow-up ${payload.contentType === 'comment' ? 'reply' : 'comment'} suggestions for the provided content.`,
      'They should feel natural as part of the same public thread.',
      'Keep them concise, distinct and publication-ready.',
      'Return only a JSON array with exactly 3 strings and no surrounding explanation.'
    ].join(' '),
    input: buildEditorialInput(payload)
  });
  await recordResponseUsage(db, 'thread', model, response);

  const suggestions = parseStringArray(response.output_text, 3).slice(0, 3);
  if (suggestions.length === 0) {
    throw apiError.badGateway('ai_empty_response');
  }

  return {
    tool: 'thread',
    model,
    suggestions
  };
}

async function runQualityCheck(client, model, payload, db) {
  const response = await client.responses.create({
    model,
    instructions: [
      'You are an editorial quality reviewer for short public posts.',
      'Evaluate the message for clarity, tone, structure and publication readiness.',
      'Return only a JSON object with these keys:',
      'verdict, summary, strengths, risks, recommendations, improvedText.',
      'verdict must be one of: ready, good_with_minor_edits, needs_work.',
      'strengths, risks and recommendations must be arrays of short strings.',
      'improvedText should be a polished improved version of the original text.',
      'Do not include markdown fences or extra commentary.'
    ].join(' '),
    input: buildEditorialInput(payload)
  });
  await recordResponseUsage(db, 'quality_check', model, response);

  const result = parseJsonObject(response.output_text);
  if (!result) {
    throw apiError.badGateway('ai_empty_response');
  }

  return {
    tool: 'quality_check',
    model,
    qualityCheck: {
      verdict: normalizeShortText(result.verdict, 60) || 'needs_work',
      summary: normalizeShortText(result.summary, 400),
      strengths: normalizeStringArray(result.strengths, 4, 180),
      risks: normalizeStringArray(result.risks, 4, 180),
      recommendations: normalizeStringArray(result.recommendations, 4, 180),
      improvedText: normalizeText(result.improvedText)
    }
  };
}

function buildEditorialInput(payload, options = {}) {
  const lines = [
    `Content type: ${payload.contentType}`,
    payload.publicProfileName ? `Public profile: ${payload.publicProfileName}` : '',
    payload.locationLabel ? `Location: ${payload.locationLabel}` : '',
    payload.parentLabel ? `Parent context: ${payload.parentLabel}` : '',
    payload.multimedia.type ? `Multimedia type: ${payload.multimedia.type}` : '',
    payload.multimedia.title ? `Multimedia title: ${payload.multimedia.title}` : '',
    payload.multimedia.description ? `Multimedia description: ${payload.multimedia.description}` : '',
    options.includeHashtagContext && payload.existingHashtags.length > 0
      ? `Existing hashtags: ${payload.existingHashtags.map((tag) => `#${tag}`).join(', ')}`
      : '',
    '',
    'Original text:',
    payload.text || '(no message text supplied)'
  ];

  return lines.filter(Boolean).join('\n');
}

function recordResponseUsage(db, tool, model, response) {
  return new Promise((resolve, reject) => {
    const usage = response?.usage;
    if (!db || !usage) {
      resolve();
      return;
    }

    tableAiUsageEvent.insert(db, {
      createdAt: Date.now(),
      tool,
      model,
      inputTokens: toPositiveNumber(usage?.input_tokens),
      outputTokens: toPositiveNumber(usage?.output_tokens),
      totalTokens: toPositiveNumber(usage?.total_tokens),
      cachedInputTokens: toPositiveNumber(usage?.input_tokens_details?.cached_tokens),
      reasoningTokens: toPositiveNumber(usage?.output_tokens_details?.reasoning_tokens)
    }, (err) => {
      if (err) {
        resolve();
        return;
      }
      resolve();
    });
  });
}

function rewriteGoalLabel(goal) {
  switch (goal) {
    case 'friendlier':
      return 'Make it friendlier';
    case 'shorter':
      return 'Make it shorter';
    case 'more_formal':
      return 'Make it more formal';
    case 'more_engaging':
      return 'Make it more engaging';
    case 'clearer':
    default:
      return 'Make it clearer';
  }
}

function parseStringArray(outputText, limit) {
  const raw = String(outputText || '').trim();
  if (!raw) {
    return [];
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || raw;

  try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean)
        .slice(0, limit);
    }
  } catch {
    // ignore and try fallback parsing
  }

  return candidate
    .split(/\r?\n|,/g)
    .map((entry) => entry.replace(/^\s*(?:[-*]|\d+\.)\s*/, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseJsonObject(outputText) {
  const raw = String(outputText || '').trim();
  if (!raw) {
    return null;
  }

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || raw;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeStringArray(value, limit, maxLength) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeShortText(entry, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeEmojiSuggestion(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 16);
}

function normalizeOpenAiError(error) {
  if (!error || typeof error !== 'object') {
    return error;
  }

  if (error.status === 429) {
    return apiError.rateLimit(error.message || 'openai_rate_limit');
  }

  if (error.status === 401 || error.status === 403) {
    return apiError.serviceUnavailable(error.message || 'openai_auth_failed');
  }

  if (error.status === 400 || error.status === 404 || error.status === 422) {
    return apiError.badRequest(error.message || 'openai_request_failed');
  }

  if (error.status >= 500 && error.status < 600) {
    return apiError.badGateway(error.message || 'openai_upstream_failed');
  }

  return error;
}

module.exports = router;
