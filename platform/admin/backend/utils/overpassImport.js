const axios = require('axios');
const { randomUUID } = require('node:crypto');
const { signServiceJwt } = require('./serviceJwt');
const { resolveBaseUrl } = require('./adminLogForwarder');
const settingsTable = require('../db/tableOverpassImportSettings');
const dispatchTable = require('../db/tableOverpassImportDispatch');

const CATEGORIES = ['accommodation', 'tourism', 'leisure', 'food_drink', 'amenities'];

function callbackResult(register) {
  return new Promise((resolve, reject) => register((error, value) => error ? reject(error) : resolve(value)));
}

function serviceBaseUrl() {
  const base = resolveBaseUrl(process.env.OVERPASS_BASE_URL, process.env.OVERPASS_PORT);
  if (!base) throw Object.assign(new Error('overpass_service_not_configured'), { status: 503 });
  return String(base).replace(/\/+$/, '');
}

async function requestService(method, path, data) {
  try {
    const token = await signServiceJwt({ audience: process.env.SERVICE_JWT_AUDIENCE_OVERPASS || 'service.overpass' });
    const response = await axios({
      method, url: `${serviceBaseUrl()}${path}`, data,
      timeout: Number(process.env.OVERPASS_ADMIN_TIMEOUT_MS || 15000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    return response.data;
  } catch (error) {
    if (error.status) throw error;
    const wrapped = new Error(error.response?.data?.message || 'overpass_service_unavailable');
    wrapped.status = error.code === 'ECONNABORTED' ? 504 : (error.response?.status || 502);
    wrapped.detail = error.response?.data || error.message;
    throw wrapped;
  }
}

function validateSettings(body) {
  const value = body && typeof body === 'object' ? body : {};
  const datasets = [...new Set(Array.isArray(value.datasets) ? value.datasets : [])];
  const categories = [...new Set(Array.isArray(value.categories) ? value.categories : [])];
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
  return { enabled: Boolean(value.enabled), datasets, categories, scheduleType, weekday, hour, minute,
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

async function dispatchImports(db, settings, triggerType) {
  const results = [];
  for (const datasetId of settings.datasets) {
    const dispatchId = randomUUID();
    const config = { datasetId, categories: settings.categories, refresh: settings.refreshSource };
    try {
      const response = await requestService('post', '/overpass/import-jobs', config);
      await callbackResult((callback) => dispatchTable.create(db, { dispatchId, serviceJobId: response.job?.jobId,
        datasetId, triggerType, status: response.job?.status || 'queued', requestedConfig: config }, callback));
      results.push({ dispatchId, datasetId, job: response.job, created: response.created });
    } catch (error) {
      await callbackResult((callback) => dispatchTable.create(db, { dispatchId, datasetId, triggerType,
        status: 'failed', requestedConfig: config, error: error.response?.data?.message || error.message }, callback));
      throw error;
    }
  }
  await callbackResult((callback) => settingsTable.markTriggered(db, Date.now(), callback));
  return results;
}

let schedulerRunning = false;
async function runScheduledImports(db, logger = console) {
  if (schedulerRunning || !db) return [];
  schedulerRunning = true;
  try {
    const settings = await callbackResult((callback) => settingsTable.get(db, callback));
    if (!isDue(settings)) return [];
    const result = await dispatchImports(db, settings, 'scheduled');
    logger.info('Scheduled Overpass imports dispatched', { count: result.length });
    return result;
  } finally {
    schedulerRunning = false;
  }
}

module.exports = { CATEGORIES, callbackResult, dispatchImports, isDue, requestService, runScheduledImports, validateSettings };
