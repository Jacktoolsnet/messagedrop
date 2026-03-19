const crypto = require('crypto');
const express = require('express');
const axios = require('axios');

const tablePublicContent = require('../db/tablePublicContent');
const tablePublicProfile = require('../db/tablePublicProfile');
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

async function callPublicBackendPublic(method, endpoint, payload) {
  const baseUrl = resolvePublicBackendBase();
  if (!baseUrl) {
    throw apiError.badGateway('backend_unavailable');
  }

  return axios.request({
    method,
    url: `${baseUrl}${endpoint}`,
    data: payload,
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
    contentType: row.contentType || tablePublicContent.contentType.PUBLIC,
    parentContent: row.parentContentIdResolved
      ? {
        id: row.parentContentIdResolved,
        contentType: row.parentContentType || tablePublicContent.contentType.PUBLIC,
        status: row.parentStatus || tablePublicContent.contentStatus.DRAFT,
        message: row.parentMessage || '',
        locationLabel: row.parentLocationLabel || '',
        publishedMessageUuid: row.parentPublishedMessageUuid || null,
        publicProfileName: row.parentPublicProfileName || ''
      }
      : null,
    publicProfile: row.publicProfileId
      ? {
        id: row.publicProfileId,
        name: row.publicProfileName || '',
        avatarImage: row.publicProfileAvatarImage || '',
        avatarAttribution: row.publicProfileAvatarAuthorName
          ? {
            source: 'unsplash',
            authorName: row.publicProfileAvatarAuthorName || '',
            authorUrl: row.publicProfileAvatarAuthorUrl || '',
            unsplashUrl: row.publicProfileAvatarUnsplashUrl || ''
          }
          : null,
        defaultStyle: row.publicProfileDefaultStyle || ''
      }
      : null,
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

function normalizeAvatarImage(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length > 2_500_000) {
    throw apiError.payloadTooLarge('Avatar image is too large');
  }
  if (normalized.startsWith('data:image/')) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return normalized;
    }
  } catch {
    // ignore
  }

  throw apiError.badRequest('Please choose a valid avatar image');
}

function normalizeOptionalHttpUrl(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return '';
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return normalized;
    }
  } catch {
    // ignore
  }
  throw apiError.badRequest('Please use a valid URL');
}

function normalizePublicProfileAvatarAttribution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      avatarAuthorName: '',
      avatarAuthorUrl: '',
      avatarUnsplashUrl: ''
    };
  }

  const source = normalizeString(value.source).toLowerCase();
  if (source && source !== 'unsplash') {
    throw apiError.badRequest('Unsupported avatar attribution source');
  }

  const authorName = normalizeString(value.authorName);
  const authorUrl = normalizeOptionalHttpUrl(value.authorUrl);
  const unsplashUrl = normalizeOptionalHttpUrl(value.unsplashUrl);

  if (!authorName && !authorUrl && !unsplashUrl) {
    return {
      avatarAuthorName: '',
      avatarAuthorUrl: '',
      avatarUnsplashUrl: ''
    };
  }

  if (!authorName || !authorUrl || !unsplashUrl) {
    throw apiError.badRequest('Unsplash attribution is incomplete');
  }

  return {
    avatarAuthorName: authorName,
    avatarAuthorUrl: authorUrl,
    avatarUnsplashUrl: unsplashUrl
  };
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
    contentType: normalizeContentType(body?.contentType),
    parentContentId: normalizeString(body?.parentContentId),
    publicProfileId: normalizeString(body?.publicProfileId),
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

function normalizeContentType(value) {
  const normalized = normalizeString(value, tablePublicContent.contentType.PUBLIC).toLowerCase();
  if (normalized === tablePublicContent.contentType.COMMENT) {
    return tablePublicContent.contentType.COMMENT;
  }
  return tablePublicContent.contentType.PUBLIC;
}

function normalizePublicProfilePayload(body) {
  const avatarAttribution = normalizePublicProfileAvatarAttribution(body?.avatarAttribution);
  return {
    name: normalizeString(body?.name),
    avatarImage: normalizeAvatarImage(body?.avatarImage),
    ...avatarAttribution,
    defaultStyle: normalizeString(body?.defaultStyle)
  };
}

function hasSelectedLocation(payload) {
  return Number(payload?.latitude) !== 0
    || Number(payload?.longitude) !== 0
    || !!normalizeString(payload?.plusCode);
}

function isCommentPayload(payload) {
  return normalizeContentType(payload?.contentType) === tablePublicContent.contentType.COMMENT;
}

function hasSelectedPublicProfile(payload) {
  return !!normalizeString(payload?.publicProfileId);
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

function getPublicProfileById(db, profileId) {
  return new Promise((resolve, reject) => {
    tablePublicProfile.getById(db, profileId, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

function getPublicContentById(db, contentId) {
  return new Promise((resolve, reject) => {
    tablePublicContent.getById(db, contentId, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

function cascadeChildCommentStatus(db, parentContentId, nextStatus) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        UPDATE ${tablePublicContent.tableName}
        SET ${tablePublicContent.columns.status} = ?,
            ${tablePublicContent.columns.publishedMessageId} = NULL,
            ${tablePublicContent.columns.withdrawnAt} = CASE WHEN ? = ? THEN ? ELSE ${tablePublicContent.columns.withdrawnAt} END,
            ${tablePublicContent.columns.deletedAt} = CASE WHEN ? = ? THEN ? ELSE ${tablePublicContent.columns.deletedAt} END,
            ${tablePublicContent.columns.updatedAt} = ?
        WHERE ${tablePublicContent.columns.parentContentId} = ?
          AND ${tablePublicContent.columns.contentType} = ?
          AND ${tablePublicContent.columns.status} = ?
      `,
      [
        nextStatus,
        nextStatus,
        tablePublicContent.contentStatus.WITHDRAWN,
        Date.now(),
        nextStatus,
        tablePublicContent.contentStatus.DELETED,
        Date.now(),
        Date.now(),
        parentContentId,
        tablePublicContent.contentType.COMMENT,
        tablePublicContent.contentStatus.PUBLISHED
      ],
      (err) => {
        if (err) {
          return reject(err);
        }
        resolve(true);
      }
    );
  });
}

function isUniqueConstraintError(error) {
  const message = String(error?.message || '').toUpperCase();
  return error?.code === 'SQLITE_CONSTRAINT' || message.includes('UNIQUE');
}

async function createPublicBackendProfileMapping() {
  const response = await callPublicBackend('post', '/user/create', {});
  if (response.status !== 200 || !response.data?.userId) {
    const err = apiError.badGateway('backend_request_failed');
    err.detail = response.data?.error || response.data?.message || response.statusText || 'public_user_create_failed';
    throw err;
  }

  return String(response.data.userId);
}

async function ensurePublicProfileMapping(req, profileRow) {
  if (!profileRow) {
    throw apiError.notFound('The selected public profile no longer exists');
  }

  if (profileRow.publicBackendUserId) {
    return {
      ...profileRow,
      publicBackendUserId: String(profileRow.publicBackendUserId)
    };
  }

  const publicBackendUserId = await createPublicBackendProfileMapping();
  await new Promise((resolve, reject) => {
    tablePublicProfile.update(req.database.db, profileRow.id, {
      [tablePublicProfile.columns.publicBackendUserId]: publicBackendUserId,
      updatedAt: Date.now()
    }, (updateErr, ok) => {
      if (updateErr) {
        return reject(updateErr);
      }
      if (!ok) {
        return reject(new Error('public_profile_update_failed'));
      }
      resolve(ok);
    });
  });

  const refreshedProfile = await getPublicProfileById(req.database.db, profileRow.id);
  if (!refreshedProfile) {
    throw apiError.notFound('The selected public profile no longer exists');
  }
  return refreshedProfile;
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

function toPublicProfileDto(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name || '',
    avatarImage: row.avatarImage || '',
    avatarAttribution: row.avatarAuthorName
      ? {
        source: 'unsplash',
        authorName: row.avatarAuthorName || '',
        authorUrl: row.avatarAuthorUrl || '',
        unsplashUrl: row.avatarUnsplashUrl || ''
      }
      : null,
    defaultStyle: row.defaultStyle || '',
    publicBackendUserId: row.publicBackendUserId || null,
    contentCount: Number(row.contentCount ?? 0),
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0)
  };
}

router.use(requireAdminJwt);

router.get('/public-profiles', requireRole(...CONTENT_ROLES), (req, res, next) => {
  tablePublicProfile.list(req.database.db, {
    query: normalizeString(req.query.q, '') || undefined
  }, (err, rows) => {
    if (err) {
      return next(apiError.internal('db_error'));
    }
    return res.json({
      status: 200,
      rows: (rows || []).map(toPublicProfileDto)
    });
  });
});

router.post('/public-profiles', [requireRole(...CONTENT_ROLES), express.json({ limit: '5mb' })], async (req, res, next) => {
  try {
    const payload = normalizePublicProfilePayload(req.body);
    if (!payload.name) {
      return next(apiError.unprocessableEntity('Profile name is required'));
    }
    if (!payload.defaultStyle) {
      return next(apiError.unprocessableEntity('Default text style is required'));
    }

    const publicBackendUserId = await createPublicBackendProfileMapping();
    tablePublicProfile.create(req.database.db, {
      ...payload,
      publicBackendUserId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, (err, result) => {
      if (err) {
        if (isUniqueConstraintError(err)) {
          return next(apiError.conflict('A public profile with this name already exists'));
        }
        return next(apiError.internal('db_error'));
      }

      tablePublicProfile.getById(req.database.db, result.id, (fetchErr, row) => {
        if (fetchErr) {
          return next(apiError.internal('db_error'));
        }
        return res.status(201).json({
          status: 201,
          row: toPublicProfileDto(row)
        });
      });
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    return next(apiError.internal('public_profile_create_failed'));
  }
});

router.put('/public-profiles/:id', [requireRole(...CONTENT_ROLES), express.json({ limit: '5mb' })], async (req, res, next) => {
  try {
    const existing = await getPublicProfileById(req.database.db, req.params.id);
    if (!existing) {
      return next(apiError.notFound('The selected public profile no longer exists'));
    }

    const payload = normalizePublicProfilePayload(req.body);
    if (!payload.name) {
      return next(apiError.unprocessableEntity('Profile name is required'));
    }
    if (!payload.defaultStyle) {
      return next(apiError.unprocessableEntity('Default text style is required'));
    }

    tablePublicProfile.update(req.database.db, req.params.id, {
      [tablePublicProfile.columns.name]: payload.name,
      [tablePublicProfile.columns.avatarImage]: payload.avatarImage,
      [tablePublicProfile.columns.avatarAuthorName]: payload.avatarAuthorName,
      [tablePublicProfile.columns.avatarAuthorUrl]: payload.avatarAuthorUrl,
      [tablePublicProfile.columns.avatarUnsplashUrl]: payload.avatarUnsplashUrl,
      [tablePublicProfile.columns.defaultStyle]: payload.defaultStyle,
      updatedAt: Date.now()
    }, (err, ok) => {
      if (err) {
        if (isUniqueConstraintError(err)) {
          return next(apiError.conflict('A public profile with this name already exists'));
        }
        return next(apiError.internal('db_error'));
      }
      if (!ok) {
        return next(apiError.notFound('The selected public profile no longer exists'));
      }

      tablePublicProfile.getById(req.database.db, req.params.id, (fetchErr, row) => {
        if (fetchErr) {
          return next(apiError.internal('db_error'));
        }
        return res.json({
          status: 200,
          row: toPublicProfileDto(row)
        });
      });
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    return next(apiError.internal('public_profile_update_failed'));
  }
});

router.delete('/public-profiles/:id', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const existing = await getPublicProfileById(req.database.db, req.params.id);
    if (!existing) {
      return next(apiError.notFound('The selected public profile no longer exists'));
    }

    const assignedCount = await new Promise((resolve, reject) => {
      tablePublicProfile.countContent(req.database.db, req.params.id, (err, total) => {
        if (err) {
          return reject(err);
        }
        resolve(Number(total ?? 0));
      });
    });

    if (assignedCount > 0) {
      return next(apiError.conflict('This public profile is still assigned to existing messages'));
    }

    tablePublicProfile.deleteById(req.database.db, req.params.id, (err, ok) => {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      if (!ok) {
        return next(apiError.notFound('The selected public profile no longer exists'));
      }

      return res.json({
        status: 200,
        deleted: true
      });
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    return next(apiError.internal('public_profile_delete_failed'));
  }
});

router.get('/public-messages', requireRole(...CONTENT_ROLES), (req, res, next) => {
  const roles = getAdminRoles(req);
  const filters = {
    authorAdminUserId: canSeeAllContent(roles) ? normalizeString(req.query.authorId, '') || undefined : getAdminUserId(req),
    publicProfileId: normalizeString(req.query.publicProfileId, '') || undefined,
    contentType: normalizeString(req.query.contentType, '') || undefined,
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

    if (!hasSelectedPublicProfile(payload)) {
      return next(apiError.unprocessableEntity('Please choose a public profile before saving'));
    }
    if (!isCommentPayload(payload) && !hasSelectedLocation(payload)) {
      return next(apiError.unprocessableEntity('Please choose a location before saving'));
    }

    const publicProfile = await getPublicProfileById(req.database.db, payload.publicProfileId);
    if (!publicProfile) {
      return next(apiError.notFound('The selected public profile no longer exists'));
    }

    let parentContentId = null;
    if (isCommentPayload(payload)) {
      parentContentId = normalizeString(payload.parentContentId) || null;
      if (!parentContentId) {
        return next(apiError.unprocessableEntity('Please choose a parent message before saving this comment'));
      }
      const parentContent = await getPublicContentById(req.database.db, parentContentId);
      if (!parentContent) {
        return next(apiError.notFound('The selected parent message no longer exists'));
      }
      if ((parentContent.contentType || tablePublicContent.contentType.PUBLIC) !== tablePublicContent.contentType.PUBLIC) {
        return next(apiError.conflict('Comments can currently only be attached to public messages'));
      }
      if (parentContent.status === tablePublicContent.contentStatus.DELETED) {
        return next(apiError.conflict('The selected parent message is deleted'));
      }
    }

    tablePublicContent.create(req.database.db, {
      authorAdminUserId: actorId,
      contentType: payload.contentType,
      parentContentId,
      publicProfileId: publicProfile.id,
      lastEditorAdminUserId: actorId,
      status: tablePublicContent.contentStatus.DRAFT,
      message: payload.message,
      latitude: isCommentPayload(payload) ? 0 : payload.latitude,
      longitude: isCommentPayload(payload) ? 0 : payload.longitude,
      plusCode: isCommentPayload(payload) ? '' : payload.plusCode,
      locationLabel: isCommentPayload(payload) ? '' : payload.locationLabel,
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

router.put('/public-messages/:id', [requireRole(...CONTENT_ROLES), express.json({ limit: '1mb' })], async (req, res, next) => {
  try {
    const row = await new Promise((resolve, reject) => {
      tablePublicContent.getById(req.database.db, req.params.id, (err, value) => {
        if (err) {
          return reject(err);
        }
        resolve(value || null);
      });
    });

    if (!row) {
      return next(apiError.notFound('not_found'));
    }
    if (!ensureManageableContent(req, row)) {
      return next(apiError.forbidden('insufficient_role'));
    }
    if (row.status === tablePublicContent.contentStatus.PUBLISHED) {
      return next(apiError.conflict('Withdraw the message before editing it'));
    }
    if (row.status === tablePublicContent.contentStatus.DELETED) {
      return next(apiError.conflict('This content has already been deleted'));
    }

    const payload = normalizeEditorPayload(req.body);
    if (!hasSelectedPublicProfile(payload)) {
      return next(apiError.unprocessableEntity('Please choose a public profile before saving'));
    }
    if (!isCommentPayload(payload) && !hasSelectedLocation(payload)) {
      return next(apiError.unprocessableEntity('Please choose a location before saving'));
    }

    const publicProfile = await getPublicProfileById(req.database.db, payload.publicProfileId);
    if (!publicProfile) {
      return next(apiError.notFound('The selected public profile no longer exists'));
    }

    let parentContentId = null;
    if (isCommentPayload(payload)) {
      parentContentId = normalizeString(payload.parentContentId) || null;
      if (!parentContentId) {
        return next(apiError.unprocessableEntity('Please choose a parent message before saving this comment'));
      }
      if (parentContentId === row.id) {
        return next(apiError.conflict('A message cannot be the parent of itself'));
      }
      const parentContent = await getPublicContentById(req.database.db, parentContentId);
      if (!parentContent) {
        return next(apiError.notFound('The selected parent message no longer exists'));
      }
      if ((parentContent.contentType || tablePublicContent.contentType.PUBLIC) !== tablePublicContent.contentType.PUBLIC) {
        return next(apiError.conflict('Comments can currently only be attached to public messages'));
      }
      if (parentContent.status === tablePublicContent.contentStatus.DELETED) {
        return next(apiError.conflict('The selected parent message is deleted'));
      }
    }

    const actor = await ensurePersistedAdminActor(req);
    const actorId = String(actor?.id || '').trim();

    await new Promise((resolve, reject) => {
      tablePublicContent.update(req.database.db, req.params.id, {
        [tablePublicContent.columns.contentType]: payload.contentType,
        [tablePublicContent.columns.parentContentId]: parentContentId,
        [tablePublicContent.columns.message]: payload.message,
        [tablePublicContent.columns.publicProfileId]: publicProfile.id,
        [tablePublicContent.columns.latitude]: isCommentPayload(payload) ? 0 : payload.latitude,
        [tablePublicContent.columns.longitude]: isCommentPayload(payload) ? 0 : payload.longitude,
        [tablePublicContent.columns.plusCode]: isCommentPayload(payload) ? '' : payload.plusCode,
        [tablePublicContent.columns.locationLabel]: isCommentPayload(payload) ? '' : payload.locationLabel,
        [tablePublicContent.columns.markerType]: payload.markerType,
        [tablePublicContent.columns.style]: payload.style,
        [tablePublicContent.columns.hashtags]: JSON.stringify(payload.hashtags),
        [tablePublicContent.columns.multimedia]: JSON.stringify(payload.multimedia),
        [tablePublicContent.columns.lastEditorAdminUserId]: actorId,
        updatedAt: Date.now()
      }, (updateErr, ok) => {
        if (updateErr) {
          return reject(updateErr);
        }
        if (!ok) {
          return reject(apiError.notFound('not_found'));
        }
        resolve(ok);
      });
    });

    const updatedRow = await new Promise((resolve, reject) => {
      tablePublicContent.getById(req.database.db, req.params.id, (fetchErr, value) => {
        if (fetchErr) {
          return reject(fetchErr);
        }
        resolve(value || null);
      });
    });

    return res.json({
      status: 200,
      row: toContentDto(updatedRow)
    });
  } catch (error) {
    if (error?.status) {
      return next(error);
    }
    req.logger?.error?.('Update public content failed', {
      adminId: getAdminUserId(req),
      contentId: req.params.id,
      error: error?.message || String(error),
      code: error?.code
    });
    return next(apiError.internal('db_error'));
  }
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
      return next(apiError.conflict('This content has already been deleted'));
    }
    if (row.status === tablePublicContent.contentStatus.PUBLISHED) {
      return next(apiError.conflict('This public message is already published'));
    }
    if (!row.publicProfileId) {
      return next(apiError.unprocessableEntity('Please choose a public profile before publishing'));
    }
    if ((row.contentType || tablePublicContent.contentType.PUBLIC) !== tablePublicContent.contentType.COMMENT && !hasSelectedLocation(row)) {
      return next(apiError.unprocessableEntity('Please choose a location before publishing'));
    }

    const publisherAdminUserId = getAdminUserId(req);
    const publicProfile = await ensurePublicProfileMapping(req, await getPublicProfileById(req.database.db, row.publicProfileId));
    const publisherPublicUserId = String(publicProfile.publicBackendUserId || '');
    if (!publisherPublicUserId) {
      return next(apiError.badGateway('public_profile_backend_user_missing'));
    }
    const publishedMessageUuid = row.publishedMessageUuid || crypto.randomUUID();
    const messageType = normalizeContentType(row.contentType);
    let parentPublishedMessageUuid = null;
    if (messageType === tablePublicContent.contentType.COMMENT) {
      if (!row.parentContentIdResolved && !row.parentContentId) {
        return next(apiError.unprocessableEntity('Please choose a parent message before publishing this comment'));
      }

      const parentContent = await getPublicContentById(req.database.db, row.parentContentIdResolved || row.parentContentId);
      if (!parentContent) {
        return next(apiError.notFound('The selected parent message no longer exists'));
      }
      if ((parentContent.contentType || tablePublicContent.contentType.PUBLIC) !== tablePublicContent.contentType.PUBLIC) {
        return next(apiError.conflict('Comments can currently only be attached to public messages'));
      }
      if (parentContent.status !== tablePublicContent.contentStatus.PUBLISHED || !parentContent.publishedMessageUuid) {
        return next(apiError.conflict('The parent message must be published before this comment can be published'));
      }
      parentPublishedMessageUuid = parentContent.publishedMessageUuid;
    }

    const publishResponse = await callPublicBackend('post', '/message/internal/publish', {
      uuid: publishedMessageUuid,
      messageTyp: messageType,
      messageUserId: publisherPublicUserId,
      latitude: messageType === tablePublicContent.contentType.COMMENT ? 0 : Number(row.latitude || 0),
      longitude: messageType === tablePublicContent.contentType.COMMENT ? 0 : Number(row.longitude || 0),
      plusCode: messageType === tablePublicContent.contentType.COMMENT ? '' : (row.plusCode || ''),
      message: row.message || '',
      markerType: row.markerType || 'default',
      style: row.style || publicProfile.defaultStyle || '',
      hashtags: parseJson(row.hashtags, []),
      multimedia: row.multimedia || '{}',
      parentUuid: parentPublishedMessageUuid || undefined
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

    if ((row.contentType || tablePublicContent.contentType.PUBLIC) === tablePublicContent.contentType.PUBLIC) {
      await cascadeChildCommentStatus(req.database.db, row.id, tablePublicContent.contentStatus.WITHDRAWN);
    }

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

    if ((row.contentType || tablePublicContent.contentType.PUBLIC) === tablePublicContent.contentType.PUBLIC) {
      await cascadeChildCommentStatus(req.database.db, row.id, tablePublicContent.contentStatus.DELETED);
    }

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

router.post('/public-messages/:id/restore', requireRole(...CONTENT_ROLES), async (req, res, next) => {
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
    if (row.status !== tablePublicContent.contentStatus.DELETED) {
      return next(apiError.conflict('This content is not deleted'));
    }

    const actor = await ensurePersistedAdminActor(req);
    const actorId = String(actor?.id || '').trim();

    await new Promise((resolve, reject) => {
      tablePublicContent.update(req.database.db, row.id, {
        [tablePublicContent.columns.status]: tablePublicContent.contentStatus.DRAFT,
        [tablePublicContent.columns.lastEditorAdminUserId]: actorId,
        [tablePublicContent.columns.publishedMessageId]: null,
        [tablePublicContent.columns.deletedAt]: null,
        [tablePublicContent.columns.withdrawnAt]: null,
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
    const err = apiError.internal('restore_failed');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.get('/avatars/unsplash/featured', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const endpoint = page > 1
    ? `/unsplash/featured/${encodeURIComponent(String(page))}`
    : '/unsplash/featured';

  try {
    const response = await callPublicBackendPublic('get', endpoint);
    return res.status(response.status).json(response.data);
  } catch (error) {
    const err = apiError.badGateway('unsplash_unavailable');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.get('/avatars/unsplash/search', requireRole(...CONTENT_ROLES), async (req, res, next) => {
  const term = normalizeString(req.query.term, '');
  if (!term) {
    return next(apiError.badRequest('Search term is required'));
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const topics = normalizeString(req.query.topics, '');
  const params = new URLSearchParams();
  if (topics) {
    params.set('topics', topics);
  }

  const queryString = params.size > 0 ? `?${params.toString()}` : '';
  const endpoint = page > 1
    ? `/unsplash/search/${encodeURIComponent(term)}/${encodeURIComponent(String(page))}${queryString}`
    : `/unsplash/search/${encodeURIComponent(term)}${queryString}`;

  try {
    const response = await callPublicBackendPublic('get', endpoint);
    return res.status(response.status).json(response.data);
  } catch (error) {
    const err = apiError.badGateway('unsplash_unavailable');
    err.detail = error?.message || String(error);
    return next(err);
  }
});

router.post('/avatars/unsplash/download', [requireRole(...CONTENT_ROLES), express.json({ limit: '64kb' })], async (req, res, next) => {
  try {
    const response = await callPublicBackendPublic('post', '/unsplash/download', {
      downloadLocation: normalizeString(req.body?.downloadLocation)
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    const err = apiError.badGateway('unsplash_unavailable');
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
