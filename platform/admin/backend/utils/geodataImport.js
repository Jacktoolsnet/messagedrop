const axios = require('axios');
const importJobEvents = require('./importJobEvents');
const { randomUUID } = require('node:crypto');
const { signServiceJwt } = require('./serviceJwt');
const { resolveBaseUrl } = require('./adminLogForwarder');
const settingsTable = require('../db/tableGeodataImportSettings');
const dispatchTable = require('../db/tableGeodataImportDispatch');

const CATEGORIES = ['accommodation', 'tourism', 'leisure', 'food_drink', 'amenities', 'religion'];

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

function serviceBaseUrl() {
  const base = resolveBaseUrl(process.env.GEODATA_BASE_URL, process.env.GEODATA_PORT);
  if (!base) throw Object.assign(new Error('geodata_service_not_configured'), { status: 503 });
  return String(base).replace(/\/+$/, '');
}

async function requestService(method, path, data, options = {}) {
  try {
    const token = await signServiceJwt({ audience: process.env.SERVICE_JWT_AUDIENCE_GEODATA || 'service.geodata' });
    const response = await axios({
      method, url: `${serviceBaseUrl()}${path}`, data,
      timeout: Number(options.timeoutMs ?? process.env.GEODATA_ADMIN_TIMEOUT_MS ?? 15000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    return response.data;
  } catch (error) {
    if (error.status) throw error;
    const wrapped = new Error(error.response?.data?.message || 'geodata_service_unavailable');
    wrapped.status = error.code === 'ECONNABORTED' ? 504 : (error.response?.status || 502);
    wrapped.detail = error.response?.data || error.message;
    throw wrapped;
  }
}

function validateSettings(body) {
  const value = body && typeof body === 'object' ? body : {};
  const datasets = [...new Set(Array.isArray(value.datasets) ? value.datasets : [])];
  const categories = [...new Set(Array.isArray(value.categories) ? value.categories : [])];
  const subcategoryInput = value.subcategories && typeof value.subcategories === 'object'
    && !Array.isArray(value.subcategories) ? value.subcategories : {};
  // A missing category entry means "all subcategories" throughout the Geodata API.
  // Preserve that distinction instead of converting missing entries to empty arrays.
  const subcategories = Object.fromEntries(categories.flatMap((category) =>
    Object.hasOwn(subcategoryInput, category)
      ? [[category, [...new Set(Array.isArray(subcategoryInput[category]) ? subcategoryInput[category] : [])]]]
      : []));
  const scheduleType = value.scheduleType === 'daily' ? 'daily' : value.scheduleType === 'weekly' ? 'weekly' : null;
  const weekday = Number(value.weekday);
  const hour = Number(value.hour);
  const minute = Number(value.minute);
  const timezone = String(value.timezone || 'Europe/Berlin');
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch { throw new Error('invalid_timezone'); }
  if (!datasets.length || datasets.some((item) => typeof item !== 'string' || !/^[a-z0-9_-]+$/.test(item))) throw new Error('invalid_datasets');
  if (!categories.length || categories.some((item) => !CATEGORIES.includes(item))) throw new Error('invalid_categories');
  if (!scheduleType || !Number.isInteger(weekday) || weekday < 0 || weekday > 6
      || !Number.isInteger(hour) || hour < 0 || hour > 23
      || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error('invalid_schedule');
  if (Object.entries(subcategories).some(([category, values]) => !CATEGORIES.includes(category)
      || values.some((item) => typeof item !== 'string' || !/^[a-z0-9_-]+$/.test(item)))) throw new Error('invalid_subcategories');
  if (!categories.some((category) => !Object.hasOwn(subcategories, category)
      || subcategories[category].length > 0)) {
    throw new Error('no_import_subcategories_selected');
  }
  return { enabled: Boolean(value.enabled), datasets, categories, subcategories, scheduleType, weekday, hour, minute,
    timezone, refreshSource: value.refreshSource !== false };
}

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { date: `${values.year}-${values.month}-${values.day}`, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(values.weekday),
    hour: Number(values.hour), minute: Number(values.minute) };
}

function isDue(settings, now = new Date()) {
  if (!settings.enabled) return false;
  const current = localParts(now, settings.timezone);
  if (settings.scheduleType === 'weekly' && current.weekday !== Number(settings.weekday)) return false;
  if (current.hour * 60 + current.minute < Number(settings.hour) * 60 + Number(settings.minute)) return false;
  if (!settings.lastTriggeredAt) return true;
  return localParts(new Date(Number(settings.lastTriggeredAt)), settings.timezone).date !== current.date;
}

async function dispatchImports(db, settings, triggerType, options = {}) {
  const results = [];
  // Plan before the first POST: the service can start a worker immediately,
  // before the remaining countries have been added to its queue.
  const selected = new Set(settings.datasets);
  const plan = await requestService('post', '/geodata/import-plan', { datasetIds: [...selected] });
  const datasets = Array.isArray(plan?.datasets) ? plan.datasets.map((entry) => entry?.datasetId) : null;
  if (!Array.isArray(datasets) || datasets.length !== selected.size
    || new Set(datasets).size !== selected.size || datasets.some((id) => !selected.has(id))) {
    throw Object.assign(new Error('invalid_geodata_import_plan'), { status: 502 });
  }
  const batchId = randomUUID();
  for (const datasetId of datasets) {
    const dispatchId = randomUUID();
    const config = { datasetId, categories: settings.categories, subcategories: settings.subcategories || {},
      refresh: settings.refreshSource, force: Boolean(options.force) };
    try {
      const response = await requestService('post', '/geodata/import-jobs', config);
      await callbackResult((callback) => dispatchTable.create(db, { dispatchId, batchId, serviceJobId: response.job?.jobId,
        datasetId, triggerType, status: response.job?.status || 'queued', requestedConfig: config }, callback));
      importJobEvents.emit('changed');
      results.push({ dispatchId, datasetId, job: response.job, created: response.created });
    } catch (error) {
      await callbackResult((callback) => dispatchTable.create(db, { dispatchId, batchId, datasetId, triggerType,
        status: 'failed', requestedConfig: config, error: error.response?.data?.message || error.message }, callback));
      importJobEvents.emit('changed');
      throw error;
    }
  }
  await callbackResult((callback) => settingsTable.markTriggered(db, Date.now(), callback));
  return results;
}

async function retryImport(db, jobId) {
  if (!/^[a-f0-9-]{36}$/i.test(jobId)) {
    throw Object.assign(new Error('invalid_import_job_id'), { status: 400 });
  }
  const dispatch = await callbackResult(cb => dispatchTable.findForRetry(db, jobId, cb));
  let original;
  if (!dispatch || dispatch.serviceJobId) {
    try {
      original = (await requestService('get', `/geodata/import-jobs/${dispatch?.serviceJobId || jobId}`)).job;
      if (!original) throw Object.assign(new Error('invalid_geodata_job_response'), { status: 502 });
    } catch (error) {
      if (error.status !== 404 || !dispatch) throw error;
      // Expired service history: the admin hand-off retains the configuration.
    }
  }
  if (dispatch && !dispatch.serviceJobId && dispatch.status !== 'failed') {
    throw Object.assign(new Error('import_job_not_failed'), { status: 409 });
  }
  if (original && original.status !== 'failed') {
    throw Object.assign(new Error('import_job_not_failed'), { status: 409 });
  }
  if (!original && !dispatch) throw Object.assign(new Error('import_job_not_found'), { status: 404 });
  const stored = original?.requestedConfig ?? dispatch?.requestedConfig;
  const config = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (!config || !Array.isArray(config.categories) || !config.categories.length) {
    throw Object.assign(new Error('import_job_config_unavailable'), { status: 409 });
  }
  const datasetId = original?.datasetId || dispatch.datasetId;
  const response = await requestService('post', '/geodata/import-jobs', {
    datasetId, categories: config.categories, subcategories: config.subcategories || {},
    refresh: config.refresh !== false, force: Boolean(config.force)
  });
  try {
    if (dispatch) {
      await callbackResult(cb => dispatchTable.replaceJob(db, dispatch.dispatchId, response.job, cb));
    }
  } finally {
    // Wake live updates and keep-alive even if persisting the new pointer fails.
    importJobEvents.emit('changed');
  }
  return response;
}

function summarizeImportJobs(jobs, now = Date.now()) {
  const totals = { jobCount: jobs.length, downloadedBytes: null, importedRecords: null, durationMs: null, incomplete: false };
  for (const job of jobs) {
    for (const key of ['downloadedBytes', 'importedRecords']) {
      const value = job.status === 'queued' ? 0 : job[key];
      if (value != null && Number.isFinite(Number(value)) && Number(value) >= 0) {
        totals[key] = (totals[key] ?? 0) + Number(value);
      } else totals.incomplete = true;
    }
    const start = job.startedAt == null ? NaN : new Date(job.startedAt).getTime();
    const end = job.status === 'running' ? now
      : job.completedAt == null ? NaN : new Date(job.completedAt).getTime();
    if (job.status === 'queued') totals.durationMs = (totals.durationMs ?? 0);
    else if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      totals.durationMs = (totals.durationMs ?? 0) + end - start;
    } else totals.incomplete = true;
  }
  return totals;
}

async function currentImportJobs(db) {
  const dispatches = await callbackResult((cb) => dispatchTable.latestBatch(db, cb));
  if (!dispatches.length) {
    // Legacy runs have no batch ID. Include the entire active queue, not just recent rows.
    const service = await requestService('get', '/geodata/import-jobs?includeActive=true');
    return { jobs: service.jobs || [], batchId: null, runStatistics: null };
  }
  const ids = [...new Set(dispatches.map((row) => row.serviceJobId).filter(Boolean))];
  const jobsById = new Map();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const query = new URLSearchParams({ jobIds: ids.slice(offset, offset + 50).join(',') });
    const service = await requestService('get', `/geodata/import-jobs?${query}`);
    for (const job of service.jobs || []) jobsById.set(job.jobId, job);
  }
  // The service queue is authoritative, even when admin dispatch records are
  // incomplete, belong to a different run, or predate a restart.
  const active = await requestService('get', '/geodata/import-jobs?activeOnly=true');
  for (const job of active.jobs || []) jobsById.set(job.jobId, job);
  const jobs = [];
  const seen = new Set();
  for (const row of dispatches) {
    const id = row.serviceJobId || row.dispatchId;
    if (seen.has(id)) continue;
    seen.add(id);
    jobs.push(jobsById.get(id) || {
      jobId: id, datasetId: row.datasetId, status: 'failed', stage: 'failed', progress: 0,
      error: row.error || 'Import job is no longer available.',
      createdAt: new Date(Number(row.createdAt)).toISOString(), startedAt: null, completedAt: null
    });
  }
  // Only this run's jobs count, not additional active jobs from other runs.
  const runStatistics = summarizeImportJobs(jobs);
  for (const job of active.jobs || []) {
    if (seen.has(job.jobId)) continue;
    seen.add(job.jobId);
    jobs.push(job);
  }
  return { jobs, batchId: dispatches[0].batchId, runStatistics };
}

let schedulerRunning = false;
async function runScheduledImports(db, logger = console) {
  if (schedulerRunning || !db) return [];
  schedulerRunning = true;
  try {
    const settings = await callbackResult((callback) => settingsTable.get(db, callback));
    if (!isDue(settings)) return [];
    const result = await dispatchImports(db, settings, 'scheduled');
    logger.info('Scheduled Geodata imports dispatched', { count: result.length });
    return result;
  } finally {
    schedulerRunning = false;
  }
}

module.exports = { CATEGORIES, callbackResult, currentImportJobs, dispatchImports, isDue, requestService, retryImport, runScheduledImports, summarizeImportJobs, validateSettings };
