const crypto = require('crypto');
const express = require('express');
const axios = require('axios');

const tablePublicContent = require('../db/tablePublicContent');
const tableUser = require('../db/tableUser');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const { encodePlusCode } = require('../utils/plusCode');

const router = express.Router();

const CONTENT_ROLES = ['author', 'editor', 'admin', 'root'];
const PUBLISH_ROLES = ['editor', 'admin', 'root'];
const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';

function resolvePublicBackendBase() {
  return resolveBaseUrl(process.env.BASE_URL, process.env.PORT);
}

async function callPublicBackend(method, endpoint, payload) {
  const baseUrl = resolvePublicBackendBase();
  if (!baseUrl) {
    throw apiError.badGateway('backend_unavailable');
  }

  const token = await signServiceJwt({ audience: backendAudience });
  return axios.request({
    method,
    url: `${baseUrl}${endpoint}`,
    data: payload,
    timeout: 10000,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    validateStatus: () => true
  });
}

async function callPublicBackendPublic(method, endpoint) {
  const baseUrl = resolvePublicBackendBase();
  if (!baseUrl) {
    throw apiError.badGateway('backend_unavailable');
  }

  return axios.request({
    method,
    url: `${baseUrl}${endpoint}`,
    timeout: 10000,
    headers: {
      Accept: 'application/json'
    },
    validateStatus: () => true
  });
}

function getAdminRoles(req) {
  return Array.isArray(req.admin?.roles) ? req.admin.roles : [];
}

function getAdminUserId(req) {
  return String(req.admin?.sub || '').trim();
}

async function ensurePersistedAdminActor(req) {
  const adminUserId = getAdminUserId(req);
  if (!adminUserId) {
    throw apiError.unauthorized('invalid_admin_token');
  }

  const existingUser = await getUserById(req.database.db, adminUserId);
  if (existingUser) {
    return existingUser;
  }

  const roles = getAdminRoles(req);
  if (adminUserId !== 'root' && !roles.includes('root')) {
    throw apiError.notFound('admin_user_not_found');
  }

  const username = normalizeString(req.admin?.username, process.env.ADMIN_ROOT_USER || 'root') || 'root';
  const email = normalizeString(process.env.ADMIN_ROOT_EMAIL || process.env.MAIL_ADDRESS || process.env.MAIL_USER, '').toLowerCase();

  return new Promise((resolve, reject) => {
    tableUser.ensureSystemUser(req.database.db, {
      id: 'root',
      username,
      email,
      role: 'root',
      passwordHash: tableUser.systemPasswordHash,
      createdAt: Date.now()
    }, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

function canSeeAllContent(roles) {
  return roles.includes('editor') || roles.includes('admin') || roles.includes('root');
}

function canPublishContent(roles) {
  return roles.includes('editor') || roles.includes('admin') || roles.includes('root');
}

function parseJson(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function defaultMultimedia() {
  return {
    type: 'undefined',
    url: '',
    sourceUrl: '',
    attribution: '',
    title: '',
    description: '',
    contentId: '',
    oembed: null
  };
}

function toContentDto(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    authorAdminUserId: row.authorAdminUserId,
    authorUsername: row.authorUsername || '',
    lastEditorAdminUserId: row.lastEditorAdminUserId || null,
    lastEditorUsername: row.lastEditorUsername || null,
    publisherAdminUserId: row.publisherAdminUserId || null,
    publisherUsername: row.publisherUsername || null,
    publisherPublicUserId: row.publisherPublicUserId || null,
    publishedMessageId: row.publishedMessageId ?? null,
    publishedMessageUuid: row.publishedMessageUuid ?? null,
    status: row.status,
    message: row.message || '',
    location: {
      latitude: Number(row.latitude || 0),
      longitude: Number(row.longitude || 0),
      plusCode: row.plusCode || '',
      label: row.locationLabel || ''
    },
    markerType: row.markerType || 'default',
    style: row.style || '',
    hashtags: parseJson(row.hashtags, []),
    multimedia: parseJson(row.multimedia, defaultMultimedia()) || defaultMultimedia(),
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    publishedAt: row.publishedAt ?? null,
    withdrawnAt: row.withdrawnAt ?? null,
    deletedAt: row.deletedAt ?? null
  };
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHashtags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item ?? '').trim().replace(/^#+/, '').toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeMultimedia(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultMultimedia();
  }

  return {
    type: normalizeString(value.type, 'undefined') || 'undefined',
    url: normalizeString(value.url),
    sourceUrl: normalizeString(value.sourceUrl),
    attribution: normalizeString(value.attribution),
    title: normalizeString(value.title),
    description: normalizeString(value.description),
    contentId: normalizeString(value.contentId),
    oembed: value.oembed && typeof value.oembed === 'object' ? value.oembed : null
  };
}

function normalizeEditorPayload(body) {
  const location = body?.location && typeof body.location === 'object' && !Array.isArray(body.location)
    ? body.location
    : {};
  const latitude = normalizeNumber(location.latitude);
  const longitude = normalizeNumber(location.longitude);
  const plusCode = normalizeString(location.plusCode);
  const locationLabel = normalizeString(location.label);
  const hasSelectedLocation = latitude !== 0 || longitude !== 0 || !!plusCode;

  return {
    message: normalizeString(body?.message),
    latitude,
    longitude,
    plusCode: plusCode || (hasSelectedLocation ? encodePlusCode(latitude, longitude) : ''),
    locationLabel,
    markerType: normalizeString(body?.markerType, 'default') || 'default',
    style: normalizeString(body?.style),
    hashtags: normalizeHashtags(body?.hashtags),
    multimedia: normalizeMultimedia(body?.multimedia)
  };
}

function hasSelectedLocation(payload) {
  return Number(payload?.latitude) !== 0
    || Number(payload?.longitude) !== 0
    || !!normalizeString(payload?.plusCode);
}

function ensureManageableContent(req, row) {
  const roles = getAdminRoles(req);
  if (canSeeAllContent(roles)) {
    return true;
  }
  return String(row?.authorAdminUserId || '') === getAdminUserId(req);
}

function getUserById(db, userId) {
  return new Promise((resolve, reject) => {
    tableUser.getById(db, userId, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

async function createPublicBackendUserMapping(req, adminUserId) {
  const response = await callPublicBackend('post', '/user/create', {});
  if (response.status !== 200 || !response.data?.userId) {
    const err = apiError.badGateway('backend_request_failed');
    err.detail = response.data?.error || response.data?.message || response.statusText || 'public_user_create_failed';
    throw err;
  }

  const publicBackendUserId = String(response.data.userId);
  await new Promise((resolve, reject) => {
    tableUser.update(req.database.db, adminUserId, { publicBackendUserId }, (updateErr, ok) => {
      if (updateErr) {
        return reject(updateErr);
      }
      if (!ok) {
        return reject(new Error('admin_user_update_failed'));
      }
      resolve(ok);
    });
  });

  return publicBackendUserId;
}

async function resolvePublisherPublicUserId(req) {
  const adminUserId = getAdminUserId(req);
  const adminUser = await ensurePersistedAdminActor(req);
  if (!adminUser) {
    throw apiError.notFound('admin_user_not_found');
  }

  if (adminUser.publicBackendUserId) {
    return String(adminUser.publicBackendUserId);
  }

  return createPublicBackendUserMapping(req, adminUserId);
}

function inferMediaProvider(url) {
  let parsed;
  try {
    parsed = new URL(String(url || '').trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'youtu.be' || host.endsWith('.youtube.com') || host === 'youtube.com') {
    return {
      type: 'youtube',
      providerUrl: 'https://www.youtube.com/oembed',
      platformName: 'YouTube'
    };
  }
  if (host === 'open.spotify.com' || host.endsWith('.spotify.com') || host.endsWith('.spotify.link') || host === 'spoti.fi') {
    return {
      type: 'spotify',
      providerUrl: 'https://open.spotify.com/oembed',
      platformName: 'Spotify'
    };
  }
  if (host === 'pin.it' || host === 'pinterest.com' || host.endsWith('.pinterest.com')) {
    return {
      type: 'pinterest',
      providerUrl: 'https://www.pinterest.com/oembed.json',
      platformName: 'Pinterest'
    };
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com') || host === 'vm.tiktok.com') {
    return {
      type: 'tiktok',
      providerUrl: 'https://www.tiktok.com/oembed',
      platformName: 'TikTok'
    };
  }
  return null;
}

router.use(requireAdminJwt);

router.get('/public-messages', requireRole(...CONTENT_ROLES), (req, res, next) => {
  const roles = getAdminRoles(req);
  const filters = {
    authorAdminUserId: canSeeAllContent(roles) ? normalizeString(req.query.authorId, '') || undefined : getAdminUserId(req),
    status: normalizeString(req.query.status, '') || undefined,
    query: normalizeString(req.query.q, '') || undefined,
    limit: Number(req.query.limit),
    offset: Number(req.query.offset),
    includeDeleted: req.query.includeDeleted === 'true'
  };

  tablePublicContent.list(req.database.db, filters, (err, rows) => {
    if (err) {
      return next(apiError.internal('db_error'));
    }

    return res.json({
      status: 200,
      rows: (rows || []).map(toContentDto)
    });
  });
});

router.get('/public-messages/:id', requireRole(...CONTENT_ROLES), (req, res, next) => {
  tablePublicContent.getById(req.database.db, req.params.id, (err, row) => {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    if (!ensureManageableContent(req, row)) {
      return next(apiError.forbidden('insufficient_role'));
    }
    return res.json({
      status: 200,
      row: toContentDto(row)
    });
  });
});

router.post('/public-messages', [requireRole(...CONTENT_ROLES), express.json({ limit: '1mb' })], async (req, res, next) => {
  try {
    const actor = await ensurePersistedAdminActor(req);
    const actorId = String(actor?.id || '').trim();
    const payload = normalizeEditorPayload(req.body);
    const now = Date.now();

    if (!hasSelectedLocation(payload)) {
      return next(apiError.unprocessableEntity('location_required'));
    }

    tablePublicContent.create(req.database.db, {
      authorAdminUserId: actorId,
      lastEditorAdminUserId: actorId,
      status: tablePublicContent.contentStatus.DRAFT,
      message: payload.message,
      latitude: payload.latitude,
      longitude: payload.longitude,
      plusCode: payload.plusCode,
      locationLabel: payload.locationLabel,
      markerType: payload.markerType,
      style: payload.style,
      hashtags: JSON.stringify(payload.hashtags),
      multimedia: JSON.stringify(payload.multimedia),
      createdAt: now,
      updatedAt: now
    }, (err, result) => {
      if (err) {
        req.logger?.error?.('Create public content failed', {
          adminId: actorId,
          error: err?.message || String(err),
          code: err?.code
        });
        return next(apiError.internal('db_error'));
      }

      tablePublicContent.getById(req.database.db, result.id, (fetchErr, row) => {
        if (fetchErr) {
          req.logger?.error?.('Load created public content failed', {
            adminId: actorId,
            contentId: result.id,
            error: fetchErr?.message || String(fetchErr),
            code: fetchErr?.code
          });
          return next(apiError.internal('db_error'));
        }
        return res.status(201).json({
          status: 201,
          row: toContentDto(row)
        });
      });
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    req.logger?.error?.('Ensure admin actor for public content create failed', {
      adminId: getAdminUserId(req),
      error: error?.message || String(error)
    });
    return next(apiError.internal('db_error'));
  }
});

router.put('/public-messages/:id', [requireRole(...CONTENT_ROLES), express.json({ limit: '1mb' })], (req, res, next) => {
  tablePublicContent.getById(req.database.db, req.params.id, (err, row) => {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    if (!ensureManageableContent(req, row)) {
      return next(apiError.forbidden('insufficient_role'));
    }
    if (row.status === tablePublicContent.contentStatus.PUBLISHED) {
      return next(apiError.conflict('withdraw_before_edit'));
    }
    if (row.status === tablePublicContent.contentStatus.DELETED) {
      return next(apiError.conflict('content_deleted'));
    }

    const payload = normalizeEditorPayload(req.body);

    if (!hasSelectedLocation(payload)) {
      return next(apiError.unprocessableEntity('location_required'));
    }

    ensurePersistedAdminActor(req)
      .then((actor) => {
        const actorId = String(actor?.id || '').trim();
        tablePublicContent.update(req.database.db, req.params.id, {
          [tablePublicContent.columns.message]: payload.message,
          [tablePublicContent.columns.latitude]: payload.latitude,
          [tablePublicContent.columns.longitude]: payload.longitude,
          [tablePublicContent.columns.plusCode]: payload.plusCode,
          [tablePublicContent.columns.locationLabel]: payload.locationLabel,
          [tablePublicContent.columns.markerType]: payload.markerType,
          [tablePublicContent.columns.style]: payload.style,
          [tablePublicContent.columns.hashtags]: JSON.stringify(payload.hashtags),
          [tablePublicContent.columns.multimedia]: JSON.stringify(payload.multimedia),
          [tablePublicContent.columns.lastEditorAdminUserId]: actorId,
          updatedAt: Date.now()
        }, (updateErr, ok) => {
          if (updateErr) {
            req.logger?.error?.('Update public content failed', {
              adminId: actorId,
              contentId: req.params.id,
              error: updateErr?.message || String(updateErr),
              code: updateErr?.code
            });
            return next(apiError.internal('db_error'));
          }
          if (!ok) {
            return next(apiError.notFound('not_found'));
          }

          tablePublicContent.getById(req.database.db, req.params.id, (fetchErr, updatedRow) => {
            if (fetchErr) {
              req.logger?.error?.('Load updated public content failed', {
                adminId: actorId,
                contentId: req.params.id,
                error: fetchErr?.message || String(fetchErr),
                code: fetchErr?.code
              });
              return next(apiError.internal('db_error'));
            }
            return res.json({
              status: 200,
              row: toContentDto(updatedRow)
            });
          });
        });
      })
      .catch((ensureErr) => {
        if (ensureErr?.status) {
          return next(ensureErr);
        }
        req.logger?.error?.('Ensure admin actor for public content update failed', {
          adminId: getAdminUserId(req),
          contentId: req.params.id,
          error: ensureErr?.message || String(ensureErr)
        });
        return next(apiError.internal('db_error'));
      });
  });
});

router.post('/public-messages/:id/publish', requireRole(...PUBLISH_ROLES), async (req, res, next) => {
  try {
    const row = await new Promise((resolve, reject) => {
      tablePublicContent.getById(req.database.db, req.params.id, (err, value) => {
        if (err) return reject(err);
        resolve(value || null);
      });
    });

    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    if (row.status === tablePublicContent.contentStatus.DELETED) {
      return next(apiError.conflict('content_deleted'));
    }
    if (row.status === tablePublicContent.contentStatus.PUBLISHED) {
      return next(apiError.conflict('already_published'));
    }
    if (!hasSelectedLocation(row)) {
      return next(apiError.unprocessableEntity('location_required'));
    }

    const publisherAdminUserId = getAdminUserId(req);
    const publisherPublicUserId = await resolvePublisherPublicUserId(req);
    const publishedMessageUuid = row.publishedMessageUuid || crypto.randomUUID();

    const publishResponse = await callPublicBackend('post', '/message/internal/publish', {
      uuid: publishedMessageUuid,
      messageTyp: 'public',
      messageUserId: publisherPublicUserId,
      latitude: Number(row.latitude || 0),
      longitude: Number(row.longitude || 0),
      plusCode: row.plusCode || '',
      message: row.message || '',
      markerType: row.markerType || 'default',
      style: row.style || '',
      hashtags: parseJson(row.hashtags, []),
      multimedia: row.multimedia || '{}'
    });

    if (publishResponse.status !== 200 || !publishResponse.data?.messageUuid) {
      const err = apiError.badGateway('backend_request_failed');
      err.detail = publishResponse.data?.error || publishResponse.data?.message || publishResponse.statusText || 'publish_failed';
      return next(err);
    }

    await new Promise((resolve, reject) => {
      tablePublicContent.update(req.database.db, row.id, {
        [tablePublicContent.columns.publisherAdminUserId]: publisherAdminUserId,
        [tablePublicContent.columns.publisherPublicUserId]: publisherPublicUserId,
        [tablePublicContent.columns.publishedMessageId]: publishResponse.data?.messageId ?? null,
        [tablePublicContent.columns.publishedMessageUuid]: publishResponse.data?.messageUuid ?? publishedMessageUuid,
        [tablePublicContent.columns.status]: tablePublicContent.contentStatus.PUBLISHED,
        [tablePublicContent.columns.publishedAt]: Date.now(),
        [tablePublicContent.columns.withdrawnAt]: null,
        [tablePublicContent.columns.deletedAt]: null,
        updatedAt: Date.now()
      }, (updateErr, ok) => {
        if (updateErr) return reject(updateErr);
        if (!ok) return reject(new Error('update_failed'));
        resolve(ok);
      });
    });

    const updated = await new Promise((resolve, reject) => {
      tablePublicContent.getById(req.database.db, row.id, (err, value) => {
        if (err) return reject(err);
        resolve(value || null);
      });
    });

    return res.json({
      status: 200,
      row: toContentDto(updated),
      publish: publishResponse.data
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    const err = apiError.internal('publish_failed');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.post('/public-messages/:id/withdraw', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const row = await new Promise((resolve, reject) => {
      tablePublicContent.getById(req.database.db, req.params.id, (err, value) => {
        if (err) return reject(err);
        resolve(value || null);
      });
    });

    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    if (!ensureManageableContent(req, row)) {
      return next(apiError.forbidden('insufficient_role'));
    }
    if (row.status !== tablePublicContent.contentStatus.PUBLISHED || !row.publishedMessageUuid) {
      return next(apiError.conflict('not_published'));
    }

    const deleteResponse = await callPublicBackend('post', '/message/internal/delete', {
      messageId: row.publishedMessageUuid
    });

    if (deleteResponse.status !== 200) {
      const err = apiError.badGateway('backend_request_failed');
      err.detail = deleteResponse.data?.error || deleteResponse.data?.message || deleteResponse.statusText || 'withdraw_failed';
      return next(err);
    }

    await new Promise((resolve, reject) => {
      tablePublicContent.update(req.database.db, row.id, {
        [tablePublicContent.columns.status]: tablePublicContent.contentStatus.WITHDRAWN,
        [tablePublicContent.columns.withdrawnAt]: Date.now(),
        [tablePublicContent.columns.publishedMessageId]: null,
        updatedAt: Date.now()
      }, (updateErr, ok) => {
        if (updateErr) return reject(updateErr);
        if (!ok) return reject(new Error('update_failed'));
        resolve(ok);
      });
    });

    const updated = await new Promise((resolve, reject) => {
      tablePublicContent.getById(req.database.db, row.id, (err, value) => {
        if (err) return reject(err);
        resolve(value || null);
      });
    });

    return res.json({
      status: 200,
      row: toContentDto(updated)
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    const err = apiError.internal('withdraw_failed');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.delete('/public-messages/:id', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const row = await new Promise((resolve, reject) => {
      tablePublicContent.getById(req.database.db, req.params.id, (err, value) => {
        if (err) return reject(err);
        resolve(value || null);
      });
    });

    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    if (!ensureManageableContent(req, row)) {
      return next(apiError.forbidden('insufficient_role'));
    }

    if (row.status === tablePublicContent.contentStatus.PUBLISHED && row.publishedMessageUuid) {
      const deleteResponse = await callPublicBackend('post', '/message/internal/delete', {
        messageId: row.publishedMessageUuid
      });
      if (deleteResponse.status !== 200) {
        const err = apiError.badGateway('backend_request_failed');
        err.detail = deleteResponse.data?.error || deleteResponse.data?.message || deleteResponse.statusText || 'delete_failed';
        return next(err);
      }
    }

    await new Promise((resolve, reject) => {
      tablePublicContent.update(req.database.db, row.id, {
        [tablePublicContent.columns.status]: tablePublicContent.contentStatus.DELETED,
        [tablePublicContent.columns.deletedAt]: Date.now(),
        [tablePublicContent.columns.publishedMessageId]: null,
        updatedAt: Date.now()
      }, (updateErr, ok) => {
        if (updateErr) return reject(updateErr);
        if (!ok) return reject(new Error('update_failed'));
        resolve(ok);
      });
    });

    return res.json({
      status: 200,
      deleted: true
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    const err = apiError.internal('delete_failed');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.get('/media/tenor/featured', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  const nextToken = normalizeString(req.query.next, '');
  const country = normalizeString(req.query.country, 'DE') || 'DE';
  const locale = normalizeString(req.query.locale, 'de_DE') || 'de_DE';
  const endpoint = nextToken
    ? `/tenor/featured/${encodeURIComponent(country)}/${encodeURIComponent(locale)}/${encodeURIComponent(nextToken)}`
    : `/tenor/featured/${encodeURIComponent(country)}/${encodeURIComponent(locale)}`;

  try {
    const response = await callPublicBackendPublic('get', endpoint);
    return res.status(response.status).json(response.data);
  } catch (error) {
    const err = apiError.badGateway('tenor_unavailable');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.get('/media/tenor/search', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  const term = normalizeString(req.query.term, '');
  if (!term) {
    return next(apiError.badRequest('missing_term'));
  }
  const nextToken = normalizeString(req.query.next, '');
  const country = normalizeString(req.query.country, 'DE') || 'DE';
  const locale = normalizeString(req.query.locale, 'de_DE') || 'de_DE';
  const endpoint = nextToken
    ? `/tenor/search/${encodeURIComponent(country)}/${encodeURIComponent(locale)}/${encodeURIComponent(term)}/${encodeURIComponent(nextToken)}`
    : `/tenor/search/${encodeURIComponent(country)}/${encodeURIComponent(locale)}/${encodeURIComponent(term)}`;

  try {
    const response = await callPublicBackendPublic('get', endpoint);
    return res.status(response.status).json(response.data);
  } catch (error) {
    const err = apiError.badGateway('tenor_unavailable');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.get('/media/oembed', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  const targetUrl = normalizeString(req.query.url, '');
  if (!targetUrl) {
    return next(apiError.badRequest('missing_url'));
  }

  const provider = inferMediaProvider(targetUrl);
  if (!provider) {
    return next(apiError.badRequest('unsupported_provider'));
  }

  try {
    const endpoint = `/utils/oembed?provider=${encodeURIComponent(provider.providerUrl)}&url=${encodeURIComponent(targetUrl)}`;
    const response = await callPublicBackendPublic('get', endpoint);
    if (response.status !== 200 || !response.data?.result) {
      const err = apiError.badGateway('oembed_failed');
      err.detail = response.data?.error || response.data?.message || response.statusText || 'oembed_failed';
      return next(err);
    }

    return res.json({
      status: 200,
      multimedia: {
        type: provider.type,
        url: '',
        sourceUrl: targetUrl,
        attribution: `Powered by ${provider.platformName}`,
        title: response.data.result?.title || '',
        description: response.data.result?.author_name || '',
        contentId: '',
        oembed: response.data.result
      }
    });
  } catch (error) {
    const err = apiError.badGateway('oembed_failed');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

module.exports = router;
