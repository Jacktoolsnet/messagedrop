const express = require('express');
const OpenAI = require('openai');

const tableAiSettings = require('../db/tableAiSettings');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');

const router = express.Router();

const AI_ROLES = ['author', 'editor', 'admin', 'root'];
const DEFAULT_ADMIN_MODEL = 'gpt-5.4';
const DEFAULT_HASHTAG_COUNT = 8;
const MAX_TEXT_LENGTH = 12_000;
const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const TOOL_TYPES = new Set(['proofread', 'rewrite', 'translate', 'hashtags']);
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

    await upsertAiSettings(req.database.db, {
      selectedModel,
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

router.post('/apply', async (req, res, next) => {
  try {
    if (!isOpenAiConfigured()) {
      throw apiError.serviceUnavailable('openai_not_configured');
    }

    const payload = normalizeToolPayload(req.body);
    const settings = await getAiSettings(req.database.db);
    const model = resolveEffectiveModel(settings?.selectedModel);
    const client = createOpenAiClient();
    const result = await runAiTool(client, model, payload);

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
    updatedAt: Number(row?.updatedAt || 0),
    apiConfigured: isOpenAiConfigured()
  };
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

async function runAiTool(client, model, payload) {
  switch (payload.tool) {
    case 'proofread':
      return runProofread(client, model, payload);
    case 'rewrite':
      return runRewrite(client, model, payload);
    case 'translate':
      return runTranslate(client, model, payload);
    case 'hashtags':
      return runHashtagGeneration(client, model, payload);
    default:
      throw apiError.badRequest('unsupported_ai_tool');
  }
}

async function runProofread(client, model, payload) {
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

async function runTranslate(client, model, payload) {
  const response = await client.responses.create({
    model,
    instructions: [
      `Translate the user provided public message or comment into ${payload.targetLanguage}.`,
      'Preserve meaning, tone, hashtags, usernames, URLs, emojis and line breaks when possible.',
      'Return only the translated text without commentary.'
    ].join(' '),
    input: buildEditorialInput(payload)
  });

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

async function runRewrite(client, model, payload) {
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

async function runHashtagGeneration(client, model, payload) {
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
