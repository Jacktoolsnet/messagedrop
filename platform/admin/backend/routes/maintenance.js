const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const axios = require('axios');
const deepl = require('deepl-node');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { signServiceJwt } = require('../utils/serviceJwt');
const { apiError } = require('../middleware/api-error');
const {
  createBackup,
  getLatestBackup,
  resolveBackupArchivePath,
  listBackups,
  validateBackup,
  prepareRestore,
  getRestoreStatus
} = require('../utils/maintenanceBackup');

const router = express.Router();
const translator = new deepl.Translator(process.env.DEEPL_API_KEY);
const RESTORE_CONFIRMATION_WORD = 'RESTORE';
const RESTORE_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const restoreChallenges = new Map();

router.use(express.json({ limit: '64kb' }));
router.use(requireAdminJwt);
router.use(requireRole('admin', 'root'));

function normalizeTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.trunc(num);
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeMaintenanceSnapshot(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: Boolean(source.enabled),
    startsAt: normalizeTimestamp(source.startsAt),
    endsAt: normalizeTimestamp(source.endsAt),
    reason: normalizeText(source.reason),
    reasonEn: normalizeText(source.reasonEn),
    reasonEs: normalizeText(source.reasonEs),
    reasonFr: normalizeText(source.reasonFr)
  };
}

function buildTemporaryMaintenancePayload() {
  return {
    enabled: true,
    startsAt: Math.floor(Date.now() / 1000),
    endsAt: null,
    reason: 'Es wird gerade ein Backup erstellt.',
    reasonEn: 'A backup is currently being created.',
    reasonEs: 'Se está creando una copia de seguridad.',
    reasonFr: 'Une sauvegarde est en cours de création.'
  };
}

function resolveBackendBase() {
  const base = (process.env.BASE_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  return process.env.PORT ? `${base}:${process.env.PORT}` : base;
}

async function callBackend(method, pathName, payload) {
  const base = resolveBackendBase();
  if (!base) {
    throw new Error('backend_unavailable');
  }
  const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';
  const serviceToken = await signServiceJwt({ audience: backendAudience });
  return axios({
    method,
    url: `${base}${pathName}`,
    data: payload,
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      Accept: 'application/json',
      'content-type': 'application/json'
    },
    timeout: 5000,
    validateStatus: () => true
  });
}

function createBackendProxyError(response, fallbackMessage) {
  const status = Number(response?.status) || 502;
  const message = response?.data?.message || response?.data?.error || fallbackMessage;
  const err = apiError.fromStatus(status, message);
  if (response?.data !== undefined) {
    err.detail = response.data;
  }
  return err;
}

async function fetchMaintenanceSnapshot() {
  const response = await callBackend('get', '/maintenance');
  if ((response?.status || 500) >= 400) {
    throw createBackendProxyError(response, 'maintenance_fetch_failed');
  }
  return normalizeMaintenanceSnapshot(response?.data?.maintenance);
}

async function setMaintenanceSnapshot(snapshot) {
  const payload = normalizeMaintenanceSnapshot(snapshot);
  const response = await callBackend('put', '/maintenance', payload);
  if ((response?.status || 500) >= 400) {
    throw createBackendProxyError(response, 'maintenance_update_failed');
  }
  return normalizeMaintenanceSnapshot(response?.data?.maintenance);
}

async function translateReason(reason) {
  const [en, es, fr] = await Promise.all([
    translator.translateText(reason, null, 'EN-GB'),
    translator.translateText(reason, null, 'ES'),
    translator.translateText(reason, null, 'FR')
  ]);
  return {
    reasonEn: en?.text || null,
    reasonEs: es?.text || null,
    reasonFr: fr?.text || null
  };
}

function purgeExpiredRestoreChallenges() {
  const now = Date.now();
  for (const [challengeId, challenge] of restoreChallenges.entries()) {
    if (!challenge || Number(challenge.expiresAt) <= now) {
      restoreChallenges.delete(challengeId);
    }
  }
}

function createRestoreChallenge(backupId) {
  purgeExpiredRestoreChallenges();
  const challengeId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
  const confirmationPin = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const expiresAt = Date.now() + RESTORE_CHALLENGE_TTL_MS;
  restoreChallenges.set(challengeId, { backupId, confirmationPin, expiresAt });
  return {
    challengeId,
    confirmationWord: RESTORE_CONFIRMATION_WORD,
    confirmationPin,
    expiresAt
  };
}

function takeRestoreChallenge(challengeId) {
  purgeExpiredRestoreChallenges();
  const challenge = restoreChallenges.get(challengeId) || null;
  restoreChallenges.delete(challengeId);
  return challenge;
}

function normalizeBackupId(value) {
  const backupId = normalizeText(value);
  return backupId || null;
}

router.get('/backup/latest', async (_req, res, next) => {
  try {
    const backup = await getLatestBackup();
    return res.status(200).json({ status: 200, backup });
  } catch (error) {
    const apiErr = apiError.internal('backup_metadata_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.get('/backup/list', async (_req, res, next) => {
  try {
    const backups = await listBackups();
    return res.status(200).json({ status: 200, backups });
  } catch (error) {
    const apiErr = apiError.internal('backup_list_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.get('/backup/:backupId/validate', async (req, res, next) => {
  const backupId = normalizeBackupId(req.params.backupId);
  if (!backupId) {
    return next(apiError.badRequest('invalid_backup_id'));
  }

  try {
    const validation = await validateBackup(backupId);
    if (!validation.backup) {
      return next(apiError.notFound('backup_not_found'));
    }
    return res.status(200).json({ status: 200, ...validation });
  } catch (error) {
    const apiErr = apiError.internal('backup_validation_failed');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.get('/backup/:backupId/download', async (req, res, next) => {
  let archivePath;
  try {
    archivePath = resolveBackupArchivePath(req.params.backupId);
  } catch {
    return next(apiError.badRequest('invalid_backup_id'));
  }

  try {
    await fs.access(archivePath);
  } catch {
    return next(apiError.notFound('backup_not_found'));
  }

  return res.download(archivePath, path.basename(archivePath), (downloadErr) => {
    if (downloadErr && !res.headersSent) {
      next(downloadErr);
    }
  });
});

router.get('/restore/status', async (_req, res, next) => {
  try {
    const restoreStatus = await getRestoreStatus();
    return res.status(200).json({ status: 200, ...restoreStatus });
  } catch (error) {
    const apiErr = apiError.internal('restore_status_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.post('/restore/challenge', async (req, res, next) => {
  const backupId = normalizeBackupId(req.body?.backupId);
  if (!backupId) {
    return next(apiError.badRequest('invalid_backup_id'));
  }

  try {
    const validation = await validateBackup(backupId);
    if (!validation.backup) {
      return next(apiError.notFound('backup_not_found'));
    }
    if (!validation.valid) {
      const apiErr = apiError.unprocessableEntity('backup_invalid');
      apiErr.detail = validation.issues;
      return next(apiErr);
    }

    const challenge = createRestoreChallenge(backupId);
    return res.status(200).json({
      status: 200,
      backup: validation.backup,
      valid: validation.valid,
      issues: validation.issues,
      challenge
    });
  } catch (error) {
    const apiErr = apiError.internal('restore_challenge_failed');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.post('/restore/prepare', async (req, res, next) => {
  const backupId = normalizeBackupId(req.body?.backupId);
  const challengeId = normalizeText(req.body?.challengeId);
  const confirmationWord = normalizeText(req.body?.confirmationWord);
  const confirmationPin = typeof req.body?.confirmationPin === 'string'
    ? req.body.confirmationPin.trim()
    : null;

  if (!backupId || !challengeId || !confirmationWord || !confirmationPin) {
    return next(apiError.badRequest('restore_confirmation_incomplete'));
  }

  const challenge = takeRestoreChallenge(challengeId);
  if (!challenge || challenge.backupId !== backupId) {
    return next(apiError.badRequest('restore_challenge_invalid'));
  }

  if (confirmationWord !== RESTORE_CONFIRMATION_WORD || confirmationPin !== challenge.confirmationPin) {
    return next(apiError.badRequest('restore_confirmation_invalid'));
  }

  try {
    const pendingRestore = await prepareRestore(backupId, { preparedBy: req.admin?.sub ?? null });
    const restoreStatus = await getRestoreStatus();
    return res.status(200).json({
      status: 200,
      pendingRestore,
      ...restoreStatus
    });
  } catch (error) {
    if (Array.isArray(error?.issues)) {
      const apiErr = apiError.unprocessableEntity('backup_invalid');
      apiErr.detail = error.issues;
      return next(apiErr);
    }
    const apiErr = apiError.internal('restore_prepare_failed');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.post('/backup', async (req, res, next) => {
  let previousMaintenance = null;
  let temporaryMaintenanceEnabled = false;

  try {
    previousMaintenance = await fetchMaintenanceSnapshot();

    if (!previousMaintenance.enabled) {
      await setMaintenanceSnapshot(buildTemporaryMaintenancePayload());
      temporaryMaintenanceEnabled = true;
    }

    const backup = await createBackup({ logger: req.logger });

    if (temporaryMaintenanceEnabled) {
      try {
        await setMaintenanceSnapshot(previousMaintenance);
        temporaryMaintenanceEnabled = false;
      } catch (restoreError) {
        const apiErr = apiError.internal('backup_created_but_maintenance_restore_failed');
        apiErr.detail = restoreError?.message || restoreError;
        apiErr.backup = backup;
        throw apiErr;
      }
    }

    return res.status(201).json({
      status: 201,
      backup,
      maintenanceTemporarilyEnabled: !previousMaintenance.enabled
    });
  } catch (error) {
    if (temporaryMaintenanceEnabled && previousMaintenance) {
      try {
        await setMaintenanceSnapshot(previousMaintenance);
      } catch (restoreError) {
        req.logger?.error?.('Maintenance restore after backup failure failed', {
          error: restoreError?.message || restoreError
        });
        if (!error?.detail) {
          error.detail = restoreError?.message || restoreError;
        }
      }
    }

    if (error?.status || error?.statusCode) {
      return next(error);
    }

    const apiErr = apiError.internal('backup_failed');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const response = await callBackend('get', '/maintenance');
    return res.status(response.status).json(response.data);
  } catch (error) {
    const apiErr = apiError.badGateway('backend_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.put('/', async (req, res, next) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return next(apiError.badRequest('invalid_enabled'));
  }

  const startsAt = normalizeTimestamp(req.body?.startsAt);
  const endsAt = normalizeTimestamp(req.body?.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) {
    return next(apiError.badRequest('invalid_maintenance_window'));
  }

  const reason = normalizeText(req.body?.reason);

  let translations = { reasonEn: null, reasonEs: null, reasonFr: null };
  if (reason) {
    try {
      translations = await translateReason(reason);
    } catch (error) {
      const apiErr = apiError.internal('translate_failed');
      apiErr.detail = error?.message || error;
      return next(apiErr);
    }
  }

  try {
    const response = await callBackend('put', '/maintenance', {
      enabled,
      startsAt,
      endsAt,
      reason,
      ...translations
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    const apiErr = apiError.badGateway('backend_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

module.exports = router;
