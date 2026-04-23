const express = require('express');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const {
  getCertificateHealthOverview,
  runCertificateHealthCheck
} = require('../utils/certificateHealth');

const router = express.Router();

router.use(requireAdminJwt, requireRole('admin', 'root'));

router.get('/', async (req, res, next) => {
  const db = req.database?.db;
  if (!db) {
    return next(apiError.internal('database_unavailable'));
  }

  try {
    const overview = await getCertificateHealthOverview(db, {
      logger: req.logger,
      autoCheckIfEmpty: true
    });
    return res.status(200).json({ status: 200, ...overview });
  } catch (error) {
    const apiErr = apiError.internal('certificate_health_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.post('/check', async (req, res, next) => {
  const db = req.database?.db;
  if (!db) {
    return next(apiError.internal('database_unavailable'));
  }

  try {
    const overview = await runCertificateHealthCheck({
      db,
      logger: req.logger,
      reason: 'manual-trigger'
    });
    return res.status(200).json({ status: 200, ...overview });
  } catch (error) {
    const apiErr = apiError.internal('certificate_health_check_failed');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

module.exports = router;
