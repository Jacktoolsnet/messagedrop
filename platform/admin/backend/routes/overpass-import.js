const express = require('express');
const { checkToken, requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const settingsTable = require('../db/tableOverpassImportSettings');
const dispatchTable = require('../db/tableOverpassImportDispatch');
const { callbackResult, dispatchImports, requestService, validateSettings } = require('../utils/overpassImport');

const router = express.Router();

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
    if (String(error.message).startsWith('invalid_')) return next(apiError.badRequest(error.message));
    return next(error);
  }
});

router.get('/catalog', async (_req, res, next) => {
  try { return res.json(await requestService('get', '/overpass/import-catalog')); }
  catch (error) { return next(error); }
});

router.post('/jobs', async (req, res, next) => {
  try {
    const stored = await callbackResult((cb) => settingsTable.get(req.database.db, cb));
    const selected = req.body && Object.keys(req.body).length ? validateSettings({ ...stored, ...req.body, enabled: true }) : stored;
    const jobs = await dispatchImports(req.database.db, selected, 'manual');
    return res.status(202).json({ status: 202, jobs });
  } catch (error) { return next(error); }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const dispatches = await callbackResult((cb) => dispatchTable.list(req.database.db, req.query.limit, cb));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const [service, metadata] = await Promise.all([
      requestService('get', `/overpass/import-jobs?limit=${limit}`),
      requestService('get', `/overpass/metadata-jobs?limit=${limit}`)
    ]);
    return res.json({ status: 200, dispatches, jobs: service.jobs || [], metadataJobs: metadata.jobs || [] });
  } catch (error) { return next(error); }
});

router.get('/database-info', async (_req, res, next) => {
  try {
    // Aggregate POI/metadata counts can take longer than ordinary API calls on large datasets.
    const databaseInfoTimeoutMs = Number(process.env.OVERPASS_DATABASE_INFO_TIMEOUT_MS || 60000);
    const [health, service, metadata] = await Promise.all([
      requestService('get', '/overpass/health', undefined, { timeoutMs: databaseInfoTimeoutMs }),
      requestService('get', '/overpass/import-jobs?limit=20'),
      requestService('get', '/overpass/metadata-jobs?limit=20')
    ]);
    return res.json({ status: 200, health, jobs: service.jobs || [], metadataJobs: metadata.jobs || [] });
  } catch (error) { return next(error); }
});

module.exports = router;
