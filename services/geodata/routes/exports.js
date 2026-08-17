const express = require('express');

function createExportRouter({ exportStore }) {
  const router = express.Router();

  router.get('/', async (_req, res, next) => {
    try {
      const manifest = await exportStore.manifest();
      return res.status(200).set('Cache-Control', 'no-cache').json({ status: 200, ...manifest });
    } catch (error) { return next(error); }
  });

  router.get('/:datasetId/current/:asset', async (req, res, next) => {
    try {
      if (!validSegment(req.params.datasetId) || !validAsset(req.params.asset)) {
        return res.status(400).json({ error: 'invalid_export_dataset' });
      }
      const row = await exportStore.active(req.params.datasetId);
      if (!row) return res.status(404).json({ error: 'geodata_export_not_found' });
      return sendAsset(res, exportStore, row, req.params.asset, false);
    } catch (error) { return next(error); }
  });

  router.get('/:datasetId/:versionId/:asset', async (req, res, next) => {
    try {
      if (!validSegment(req.params.datasetId) || !validSegment(req.params.versionId) || !validAsset(req.params.asset)) {
        return res.status(400).json({ error: 'invalid_export_version' });
      }
      const row = await exportStore.version(req.params.datasetId, req.params.versionId);
      if (!row) return res.status(404).json({ error: 'geodata_export_not_found' });
      return sendAsset(res, exportStore, row, req.params.asset, true);
    } catch (error) { return next(error); }
  });

  return router;
}

function sendAsset(res, exportStore, row, asset, immutable) {
  const filePath = exportStore.assetPath(row, asset);
  res.set('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.set('X-Content-Type-Options', 'nosniff');
  const base = `/geodata/exports/${encodeURIComponent(row.datasetId)}/${encodeURIComponent(row.versionId)}`;
  res.set('Link', `<${base}/license>; rel="license", <${base}/metadata>; rel="describedby"`);
  if (asset === 'data') {
    res.type('application/gzip');
    res.set('Content-Disposition', `attachment; filename="${row.datasetId}-${row.versionId}.jsonl.gz"`);
    res.set('Digest', `sha-256=${Buffer.from(row.sha256, 'hex').toString('base64')}`);
  } else if (asset === 'metadata') res.type('application/json');
  else res.type('text/plain; charset=utf-8');
  return res.sendFile(filePath);
}

function validSegment(value) {
  return /^[a-zA-Z0-9_-]+$/u.test(String(value || ''));
}

function validAsset(value) {
  return ['data', 'metadata', 'license'].includes(value);
}

module.exports = { createExportRouter, validAsset, validSegment };
