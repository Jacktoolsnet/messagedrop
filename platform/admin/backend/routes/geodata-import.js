const express = require('express');
const { checkToken, requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const settingsTable = require('../db/tableGeodataImportSettings');
const { callbackResult, currentImportJobs, dispatchImports, requestService, retryImport, validateSettings } = require('../utils/geodataImport');

const router = express.Router();
const { requireServiceJwt } = require('../utils/serviceJwt');
const importJobEvents = require('../utils/importJobEvents');

router.post('/events', requireServiceJwt, (req, res, next) => {
  if (req.service?.iss !== (process.env.GEODATA_SERVICE_JWT_ISSUER || 'service.geodata')) {
    return next(apiError.forbidden('invalid_geodata_event_source'));
  }
  importJobEvents.emit('changed');
  res.sendStatus(202);
});

function isSettingsValidationError(error) {
  return String(error?.message || '').startsWith('invalid_')
    || error?.message === 'no_import_subcategories_selected';
}

router.get('/active-categories', checkToken, async (req, res, next) => {
  try {
    const settings = await callbackResult((cb) => settingsTable.get(req.database.db, cb));
    const categories = [...new Set(settings.categories || [])];
    const subcategories = Object.fromEntries(categories.map((category) => [
      category,
      [...new Set(Array.isArray(settings.subcategories?.[category]) ? settings.subcategories[category] : [])]
    ]));
    return res.json({ status: 200, categories, subcategories, updatedAt: settings.updatedAt });
  } catch (error) { return next(error); }
});

router.use(requireAdminJwt, requireRole('admin', 'root'));

router.get('/settings', async (req, res, next) => {
  try { return res.json({ status: 200, settings: await callbackResult((cb) => settingsTable.get(req.database.db, cb)) }); }
  catch (error) { return next(error); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const value = validateSettings(req.body);
    const settings = await callbackResult((cb) => settingsTable.upsert(req.database.db, value, cb));
    return res.json({ status: 200, settings });
  } catch (error) {
    if (isSettingsValidationError(error)) return next(apiError.badRequest(error.message));
    return next(error);
  }
});

router.get('/catalog', async (_req, res, next) => {
  try { return res.json(await requestService('get', '/geodata/import-catalog')); }
  catch (error) { return next(error); }
});

router.post('/jobs', async (req, res, next) => {
  try {
    const stored = await callbackResult((cb) => settingsTable.get(req.database.db, cb));
    const selected = validateSettings(req.body && Object.keys(req.body).length
      ? { ...stored, ...req.body, enabled: true }
      : stored);
    const jobs = await dispatchImports(req.database.db, selected, 'manual', { force: Boolean(req.body?.force) });
    return res.status(202).json({ status: 202, jobs });
  } catch (error) {
    if (isSettingsValidationError(error)) return next(apiError.badRequest(error.message));
    return next(error);
  }
});

router.post('/jobs/:jobId/retry', async (req, res, next) => {
  try {
    const result = await retryImport(req.database.db, req.params.jobId);
    return res.status(202).json({ ...result, status: 202 });
  } catch (error) { return next(error); }
});

router.get('/jobs', async (req, res, next) => {
  try {
    return res.json({ status: 200, ...await currentImportJobs(req.database.db) });
  } catch (error) { return next(error); }
});

router.get('/database-info', async (req, res, next) => {
  try {
    // Aggregate POI counts can take longer than ordinary API calls on large datasets.
    const databaseInfoTimeoutMs = Number(process.env.GEODATA_DATABASE_INFO_TIMEOUT_MS || 60000);
    const [health, service] = await Promise.all([
      requestService('get', '/geodata/health', undefined, { timeoutMs: databaseInfoTimeoutMs }),
      currentImportJobs(req.database.db)
    ]);
    return res.json({ status: 200, health, ...service });
  } catch (error) { return next(error); }
});

module.exports = router;
