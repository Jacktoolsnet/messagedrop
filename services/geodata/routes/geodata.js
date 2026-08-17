const express = require('express');
const { requireServiceJwt } = require('../utils/serviceJwt');
const { validateNearbyRequest } = require('../validation');
const { categoryNames, categoryCatalog } = require('../categories');

function createGeodataRouter({ localPoiStore, importJobManager, metrics = {} }) {
  const router = express.Router();
  router.use(requireServiceJwt);

  router.get('/health', async (_req, res, next) => {
    metrics.health = (metrics.health || 0) + 1;
    try {
      const local = await localPoiStore?.status();
      return res.status(200).json({ status: 200, mode: local?.datasetCount > 0 ? 'local' : 'empty', local });
    } catch (error) { return next(error); }
  });

  router.get('/categories', (_req, res) => {
    metrics.categories = (metrics.categories || 0) + 1;
    return res.status(200).json({ status: 200, categories: categoryNames(), catalog: categoryCatalog() });
  });

  router.get('/import-catalog', async (_req, res, next) => {
    try {
      return res.status(200).json({
        status: 200,
        datasets: await importJobManager?.catalog?.() || [],
        categories: categoryCatalog()
      });
    } catch (error) { return next(error); }
  });

  router.post('/import-jobs', async (req, res, next) => {
    if (!importJobManager) return res.status(503).json({ error: 'import_jobs_unavailable' });
    try {
      const result = await importJobManager.start(req.body || {});
      return res.status(result.created ? 202 : 200).json({ status: result.created ? 202 : 200, ...result });
    } catch (error) { return next(error); }
  });

  router.get('/import-jobs', async (req, res, next) => {
    if (!importJobManager) return res.status(503).json({ error: 'import_jobs_unavailable' });
    try {
      return res.status(200).json({ status: 200, jobs: await importJobManager.list(req.query.limit) });
    } catch (error) { return next(error); }
  });

  router.get('/import-jobs/:jobId', async (req, res, next) => {
    if (!importJobManager) return res.status(503).json({ error: 'import_jobs_unavailable' });
    try {
      const job = await importJobManager.get(req.params.jobId);
      return job ? res.status(200).json({ status: 200, job }) : res.status(404).json({ error: 'import_job_not_found' });
    } catch (error) { return next(error); }
  });

  router.post('/nearby', async (req, res, next) => {
    metrics.nearby = (metrics.nearby || 0) + 1;
    const validated = validateNearbyRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    try {
      const local = await localPoiStore?.getNearby(validated.value);
      if (local) return res.status(200).json({ ...local, cache: 'local', coverage: true });
      return res.status(200).json({
        status: 200, pois: [], count: 0, cache: 'local', coverage: false,
        attribution: {
          provider: 'OpenStreetMap', text: '© OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/copyright', license: 'ODbL 1.0'
        },
        source: { type: 'local-dataset', datasetId: null, versionId: null, timestamp: null, importedAt: null, url: null }
      });
    } catch (error) { return next(error); }
  });

  router.get('/metrics', (_req, res) => res.status(200).json({
    status: 200, localPoiStore: localPoiStore?.snapshot(), requests: { ...metrics }
  }));

  return router;
}

module.exports = { createGeodataRouter };
