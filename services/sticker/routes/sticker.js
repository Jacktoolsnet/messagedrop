const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const security = require('../middleware/security');
const tableStickerCategory = require('../db/tableStickerCategory');
const tableStickerPack = require('../db/tableStickerPack');
const tableSticker = require('../db/tableSticker');
const tableStickerSettings = require('../db/tableStickerSettings');
const { resolveFlaticonPackMetadata } = require('../utils/flaticon');

const router = express.Router();

const STORAGE_ROOT = path.join(__dirname, '..', 'storage');
const READER_ISSUERS = new Set(['service.backend', 'service.admin-backend']);
const ADMIN_ISSUERS = new Set(['service.admin-backend']);
const VALID_STATUSES = new Set(['active', 'hidden', 'blocked', 'deleted']);
const RENDERABLE_STATUSES = new Set(['active', 'hidden']);
const VALID_VARIANTS = new Set(['preview', 'chat', 'original']);

function buildError(status, message, detail) {
  const error = new Error(message);
  error.status = status;
  error.message = message;
  error.error = message;
  if (detail !== undefined) {
    error.detail = detail;
  }
  return error;
}

function toPromise(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, value) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(value);
    });
  });
}

function getDatabase(req) {
  const db = req.database?.db;
  if (!db) {
    throw buildError(503, 'database_unavailable');
  }
  return db;
}

function getIssuer(req) {
  return typeof req.service?.iss === 'string' ? req.service.iss.trim() : '';
}

function requireIssuer(allowedIssuers) {
  return (req, _res, next) => {
    const issuer = getIssuer(req);
    if (!allowedIssuers.has(issuer)) {
      next(buildError(403, 'forbidden'));
      return;
    }
    next();
  };
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeString(value, { maxLength = 500, allowEmpty = false, fallback = '' } = {}) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return allowEmpty ? '' : fallback;
  }
  return trimmed.slice(0, maxLength);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function normalizeSlug(value, fallbackSource) {
  const source = normalizeString(value, { maxLength: 160, allowEmpty: true }) || fallbackSource;
  const slug = slugify(source);
  if (!slug) {
    throw buildError(400, 'invalid_slug');
  }
  return slug;
}

function normalizeStatus(value, fallback = 'active') {
  const normalized = normalizeString(value, { maxLength: 32, allowEmpty: true, fallback: fallback }).toLowerCase();
  if (!VALID_STATUSES.has(normalized)) {
    throw buildError(400, 'invalid_status');
  }
  return normalized;
}

function normalizeKeywords(value) {
  let values = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string' && value.trim()) {
    values = value.split(',');
  }

  const normalized = [];
  const seen = new Set();
  for (const entry of values) {
    const cleaned = normalizeString(String(entry ?? ''), { maxLength: 50, allowEmpty: true }).toLowerCase();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    normalized.push(cleaned);
    if (normalized.length >= 50) {
      break;
    }
  }
  return normalized;
}

function normalizeRelativeAssetPath(value) {
  const normalized = normalizeString(value, { maxLength: 1000, allowEmpty: true });
  if (!normalized) {
    return '';
  }
  if (path.isAbsolute(normalized)) {
    throw buildError(400, 'invalid_asset_path');
  }
  const cleaned = normalized.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = cleaned.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw buildError(400, 'invalid_asset_path');
  }
  return segments.join('/');
}

function normalizeMimeType(value) {
  return normalizeString(value, { maxLength: 120, allowEmpty: true });
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function normalizeOptionalInteger(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw buildError(400, 'invalid_number');
  }
  return Math.round(parsed);
}

function resolveStorageFile(relativePath) {
  if (!relativePath) {
    return null;
  }
  const resolved = path.resolve(STORAGE_ROOT, relativePath);
  const base = STORAGE_ROOT.endsWith(path.sep) ? STORAGE_ROOT : `${STORAGE_ROOT}${path.sep}`;
  if (resolved !== STORAGE_ROOT && !resolved.startsWith(base)) {
    return null;
  }
  return resolved;
}

function normalizeSvgFileName(value) {
  const raw = normalizeString(value, { maxLength: 240, allowEmpty: true });
  const segments = raw.split(/[\\/]/).filter(Boolean);
  const fileName = segments[segments.length - 1] || '';
  const replaced = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const ensuredSvg = replaced.toLowerCase().endsWith('.svg') ? replaced : `${replaced || 'sticker'}.svg`;
  return ensuredSvg.slice(0, 180);
}

function decodeBase64Utf8(value) {
  try {
    return Buffer.from(String(value || ''), 'base64').toString('utf8');
  } catch {
    throw buildError(400, 'invalid_file_payload');
  }
}

function sanitizeSvgMarkup(svgMarkup) {
  const trimmed = String(svgMarkup || '').trim();
  if (!trimmed || !/^<svg[\s>]/i.test(trimmed)) {
    throw buildError(400, 'invalid_svg_file');
  }

  const forbiddenPatterns = [
    /<script\b/i,
    /<foreignObject\b/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<!ENTITY/i,
    /<!DOCTYPE/i,
    /\son[a-z]+\s*=/i,
    /javascript:/i
  ];
  if (forbiddenPatterns.some((pattern) => pattern.test(trimmed))) {
    throw buildError(400, 'unsafe_svg_file');
  }

  return trimmed
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .trim();
}

async function ensureDirectory(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function writeStickerSvgFiles(packId, normalizedFileName, sanitizedSvg) {
  const baseDir = path.join('packs', packId);
  const originalRelativePath = path.posix.join('original', baseDir, normalizedFileName);
  const previewRelativePath = path.posix.join('preview', baseDir, normalizedFileName);
  const chatRelativePath = path.posix.join('chat', baseDir, normalizedFileName);
  const targets = [originalRelativePath, previewRelativePath, chatRelativePath];

  await Promise.all(targets.map(async (relativePath) => {
    const absolutePath = resolveStorageFile(relativePath);
    if (!absolutePath) {
      throw buildError(500, 'storage_path_resolution_failed');
    }
    await ensureDirectory(path.dirname(absolutePath));
    await fs.promises.writeFile(absolutePath, sanitizedSvg, 'utf8');
  }));

  return {
    originalPath: originalRelativePath,
    previewPath: previewRelativePath,
    chatPath: chatRelativePath
  };
}

function safeParseJsonArray(value) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseJsonObject(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toCategoryDto(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    previewStickerId: row.previewStickerId || null,
    status: row.status,
    sortOrder: Number(row.sortOrder ?? 0),
    packCount: Number(row.packCount ?? 0),
    stickerCount: Number(row.stickerCount ?? 0),
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
    deletedAt: row.deletedAt ?? null
  };
}

function toPackDto(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName || '',
    categorySlug: row.categorySlug || '',
    name: row.name,
    slug: row.slug,
    previewStickerId: row.previewStickerId || null,
    sourceProvider: row.sourceProvider || 'manual',
    sourceReference: row.sourceReference || '',
    sourceMetadata: safeParseJsonObject(row.sourceMetadataJson),
    licenseNote: row.licenseNote || '',
    searchVisible: Boolean(row.searchVisible),
    status: row.status,
    sortOrder: Number(row.sortOrder ?? 0),
    stickerCount: Number(row.stickerCount ?? 0),
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
    deletedAt: row.deletedAt ?? null
  };
}

function toStickerDto(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    packId: row.packId,
    packName: row.packName || '',
    packSlug: row.packSlug || '',
    categoryId: row.categoryId || '',
    categoryName: row.categoryName || '',
    categorySlug: row.categorySlug || '',
    name: row.name,
    slug: row.slug,
    keywords: safeParseJsonArray(row.keywords),
    previewPath: row.previewPath || '',
    previewMimeType: row.previewMimeType || '',
    chatPath: row.chatPath || '',
    chatMimeType: row.chatMimeType || '',
    originalPath: row.originalPath || '',
    originalMimeType: row.originalMimeType || '',
    width: row.width ?? null,
    height: row.height ?? null,
    searchVisible: Boolean(row.searchVisible),
    status: row.status,
    sortOrder: Number(row.sortOrder ?? 0),
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0),
    deletedAt: row.deletedAt ?? null
  };
}

function toSettingsDto(row) {
  if (!row) {
    return null;
  }
  return {
    notFoundStickerId: row.notFoundStickerId || null,
    createdAt: Number(row.createdAt ?? 0),
    updatedAt: Number(row.updatedAt ?? 0)
  };
}

async function getCategoryOrThrow(db, categoryId) {
  const category = await toPromise(tableStickerCategory.getById, db, categoryId);
  if (!category) {
    throw buildError(404, 'sticker_category_not_found');
  }
  return category;
}

async function getPackOrThrow(db, packId) {
  const pack = await toPromise(tableStickerPack.getById, db, packId);
  if (!pack) {
    throw buildError(404, 'sticker_pack_not_found');
  }
  return pack;
}

async function getStickerOrThrow(db, stickerId) {
  const sticker = await toPromise(tableSticker.getById, db, stickerId);
  if (!sticker) {
    throw buildError(404, 'sticker_not_found');
  }
  return sticker;
}

async function ensureStickerReferenceValid(db, stickerId, { allowEmpty = true, allowDeleted = false } = {}) {
  if (!stickerId) {
    if (allowEmpty) {
      return null;
    }
    throw buildError(400, 'sticker_reference_required');
  }
  const sticker = await toPromise(tableSticker.getById, db, stickerId);
  if (!sticker) {
    throw buildError(404, 'sticker_not_found');
  }
  if (!allowDeleted && !RENDERABLE_STATUSES.has(String(sticker.status || '').toLowerCase())) {
    throw buildError(409, 'sticker_not_renderable');
  }
  return sticker;
}

function chooseVariantPath(sticker, variant) {
  if (!sticker) {
    return { relativePath: '', mimeType: '' };
  }
  if (variant === 'original') {
    return {
      relativePath: sticker.originalPath || sticker.chatPath || sticker.previewPath || '',
      mimeType: sticker.originalMimeType || sticker.chatMimeType || sticker.previewMimeType || ''
    };
  }
  if (variant === 'preview') {
    return {
      relativePath: sticker.previewPath || sticker.chatPath || sticker.originalPath || '',
      mimeType: sticker.previewMimeType || sticker.chatMimeType || sticker.originalMimeType || ''
    };
  }
  return {
    relativePath: sticker.chatPath || sticker.previewPath || sticker.originalPath || '',
    mimeType: sticker.chatMimeType || sticker.previewMimeType || sticker.originalMimeType || ''
  };
}

async function resolveRenderableStickerAsset(db, stickerId, variant, visited = new Set()) {
  const normalizedStickerId = normalizeString(stickerId, { maxLength: 120, allowEmpty: true });
  if (!normalizedStickerId || visited.has(normalizedStickerId)) {
    return null;
  }
  visited.add(normalizedStickerId);

  const settings = await toPromise(tableStickerSettings.get, db);
  const sticker = await toPromise(tableSticker.getById, db, normalizedStickerId);
  if (!sticker || !RENDERABLE_STATUSES.has(String(sticker.status || '').toLowerCase())) {
    const fallbackId = normalizeString(settings?.notFoundStickerId, { maxLength: 120, allowEmpty: true });
    if (!fallbackId || fallbackId === normalizedStickerId) {
      return null;
    }
    return resolveRenderableStickerAsset(db, fallbackId, variant, visited);
  }

  const asset = chooseVariantPath(sticker, variant);
  const filePath = resolveStorageFile(asset.relativePath);
  if (filePath && fs.existsSync(filePath)) {
    return {
      sticker,
      relativePath: asset.relativePath,
      filePath,
      mimeType: asset.mimeType || 'application/octet-stream',
      isFallback: normalizedStickerId !== stickerId
    };
  }

  const fallbackId = normalizeString(settings?.notFoundStickerId, { maxLength: 120, allowEmpty: true });
  if (!fallbackId || fallbackId === normalizedStickerId) {
    return null;
  }
  return resolveRenderableStickerAsset(db, fallbackId, variant, visited);
}

async function createCategoryPayload(db, body, { existing } = {}) {
  const rawName = hasOwn(body, 'name') ? body?.name : existing?.name;
  const name = normalizeString(rawName, { maxLength: 120 });
  if (!name) {
    throw buildError(400, 'category_name_required');
  }
  const rawPreviewStickerId = hasOwn(body, 'previewStickerId') ? body?.previewStickerId : existing?.previewStickerId;
  const previewStickerId = normalizeString(rawPreviewStickerId, { maxLength: 120, allowEmpty: true }) || null;
  if (previewStickerId) {
    await ensureStickerReferenceValid(db, previewStickerId);
  }
  return {
    id: existing?.id || normalizeString(body?.id, { maxLength: 120, allowEmpty: true }) || crypto.randomUUID(),
    name,
    slug: normalizeSlug(hasOwn(body, 'slug') ? body?.slug : existing?.slug, name),
    previewStickerId,
    status: normalizeStatus(hasOwn(body, 'status') ? body?.status : existing?.status, existing?.status || 'active'),
    sortOrder: parseInteger(hasOwn(body, 'sortOrder') ? body?.sortOrder : existing?.sortOrder, Number(existing?.sortOrder ?? 0), { min: -100000, max: 100000 })
  };
}

async function createPackPayload(db, body, { existing } = {}) {
  const rawName = hasOwn(body, 'name') ? body?.name : existing?.name;
  const name = normalizeString(rawName, { maxLength: 120 });
  if (!name) {
    throw buildError(400, 'pack_name_required');
  }
  const rawCategoryId = hasOwn(body, 'categoryId') ? body?.categoryId : existing?.categoryId;
  const categoryId = normalizeString(rawCategoryId, { maxLength: 120 }) || existing?.categoryId;
  if (!categoryId) {
    throw buildError(400, 'category_id_required');
  }
  const category = await getCategoryOrThrow(db, categoryId);
  if (String(category.status).toLowerCase() === 'deleted') {
    throw buildError(409, 'sticker_category_deleted');
  }
  const rawPreviewStickerId = hasOwn(body, 'previewStickerId') ? body?.previewStickerId : existing?.previewStickerId;
  const previewStickerId = normalizeString(rawPreviewStickerId, { maxLength: 120, allowEmpty: true }) || null;
  if (previewStickerId) {
    await ensureStickerReferenceValid(db, previewStickerId);
  }
  const rawSourceMetadata = hasOwn(body, 'sourceMetadata')
    ? body?.sourceMetadata
    : safeParseJsonObject(existing?.sourceMetadataJson);
  const sourceMetadataJson = rawSourceMetadata && typeof rawSourceMetadata === 'object' && !Array.isArray(rawSourceMetadata)
    ? JSON.stringify(rawSourceMetadata)
    : '';
  return {
    id: existing?.id || normalizeString(body?.id, { maxLength: 120, allowEmpty: true }) || crypto.randomUUID(),
    categoryId,
    name,
    slug: normalizeSlug(hasOwn(body, 'slug') ? body?.slug : existing?.slug, name),
    previewStickerId,
    sourceProvider: normalizeString(hasOwn(body, 'sourceProvider') ? body?.sourceProvider : existing?.sourceProvider, { maxLength: 80, allowEmpty: true, fallback: existing?.sourceProvider || 'manual' }) || 'manual',
    sourceReference: normalizeString(hasOwn(body, 'sourceReference') ? body?.sourceReference : existing?.sourceReference, { maxLength: 1000, allowEmpty: true }),
    sourceMetadataJson,
    licenseNote: normalizeString(hasOwn(body, 'licenseNote') ? body?.licenseNote : existing?.licenseNote, { maxLength: 4000, allowEmpty: true }),
    searchVisible: parseBoolean(hasOwn(body, 'searchVisible') ? body?.searchVisible : existing?.searchVisible, existing ? Boolean(existing.searchVisible) : true),
    status: normalizeStatus(hasOwn(body, 'status') ? body?.status : existing?.status, existing?.status || 'active'),
    sortOrder: parseInteger(hasOwn(body, 'sortOrder') ? body?.sortOrder : existing?.sortOrder, Number(existing?.sortOrder ?? 0), { min: -100000, max: 100000 })
  };
}

async function createStickerPayload(db, body, { existing, forcedPackId } = {}) {
  const rawName = hasOwn(body, 'name') ? body?.name : existing?.name;
  const name = normalizeString(rawName, { maxLength: 120 });
  if (!name) {
    throw buildError(400, 'sticker_name_required');
  }

  const rawPackId = forcedPackId || (hasOwn(body, 'packId') ? body?.packId : existing?.packId);
  const packId = forcedPackId || normalizeString(rawPackId, { maxLength: 120 }) || existing?.packId;
  if (!packId) {
    throw buildError(400, 'pack_id_required');
  }
  const pack = await getPackOrThrow(db, packId);
  if (String(pack.status).toLowerCase() === 'deleted') {
    throw buildError(409, 'sticker_pack_deleted');
  }

  return {
    id: existing?.id || normalizeString(body?.id, { maxLength: 120, allowEmpty: true }) || crypto.randomUUID(),
    packId,
    name,
    slug: normalizeSlug(hasOwn(body, 'slug') ? body?.slug : existing?.slug, name),
    keywords: JSON.stringify(normalizeKeywords(hasOwn(body, 'keywords') ? body?.keywords : safeParseJsonArray(existing?.keywords))),
    previewPath: normalizeRelativeAssetPath(hasOwn(body, 'previewPath') ? body?.previewPath : existing?.previewPath),
    previewMimeType: normalizeMimeType(hasOwn(body, 'previewMimeType') ? body?.previewMimeType : existing?.previewMimeType),
    chatPath: normalizeRelativeAssetPath(hasOwn(body, 'chatPath') ? body?.chatPath : existing?.chatPath),
    chatMimeType: normalizeMimeType(hasOwn(body, 'chatMimeType') ? body?.chatMimeType : existing?.chatMimeType),
    originalPath: normalizeRelativeAssetPath(hasOwn(body, 'originalPath') ? body?.originalPath : existing?.originalPath),
    originalMimeType: normalizeMimeType(hasOwn(body, 'originalMimeType') ? body?.originalMimeType : existing?.originalMimeType),
    width: normalizeOptionalInteger(hasOwn(body, 'width') ? body?.width : existing?.width),
    height: normalizeOptionalInteger(hasOwn(body, 'height') ? body?.height : existing?.height),
    searchVisible: parseBoolean(hasOwn(body, 'searchVisible') ? body?.searchVisible : existing?.searchVisible, existing ? Boolean(existing.searchVisible) : true),
    status: normalizeStatus(hasOwn(body, 'status') ? body?.status : existing?.status, existing?.status || 'active'),
    sortOrder: parseInteger(hasOwn(body, 'sortOrder') ? body?.sortOrder : existing?.sortOrder, Number(existing?.sortOrder ?? 0), { min: -100000, max: 100000 })
  };
}

router.use(security.checkToken);

router.get('/categories', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const rows = await toPromise(tableStickerCategory.list, db, {
      includeDeleted: parseBoolean(req.query.includeDeleted, false),
      status: normalizeString(req.query.status, { maxLength: 32, allowEmpty: true }),
      query: normalizeString(req.query.q, { maxLength: 120, allowEmpty: true })
    });
    res.status(200).json({ status: 200, rows: rows.map(toCategoryDto) });
  } catch (err) {
    next(err);
  }
});

router.get('/categories/:id', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const row = await getCategoryOrThrow(db, req.params.id);
    res.status(200).json({ status: 200, row: toCategoryDto(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/categories/:id/packs', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    await getCategoryOrThrow(db, req.params.id);
    const rows = await toPromise(tableStickerPack.list, db, {
      includeDeleted: parseBoolean(req.query.includeDeleted, false),
      categoryId: req.params.id,
      status: normalizeString(req.query.status, { maxLength: 32, allowEmpty: true }),
      searchVisible: req.query.searchVisible === undefined ? undefined : parseBoolean(req.query.searchVisible, true),
      query: normalizeString(req.query.q, { maxLength: 120, allowEmpty: true })
    });
    res.status(200).json({ status: 200, rows: rows.map(toPackDto) });
  } catch (err) {
    next(err);
  }
});

router.get('/packs', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const rows = await toPromise(tableStickerPack.list, db, {
      includeDeleted: parseBoolean(req.query.includeDeleted, false),
      categoryId: normalizeString(req.query.categoryId, { maxLength: 120, allowEmpty: true }),
      status: normalizeString(req.query.status, { maxLength: 32, allowEmpty: true }),
      searchVisible: req.query.searchVisible === undefined ? undefined : parseBoolean(req.query.searchVisible, true),
      query: normalizeString(req.query.q, { maxLength: 120, allowEmpty: true })
    });
    res.status(200).json({ status: 200, rows: rows.map(toPackDto) });
  } catch (err) {
    next(err);
  }
});

router.get('/packs/:id', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const row = await getPackOrThrow(db, req.params.id);
    res.status(200).json({ status: 200, row: toPackDto(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/packs/:id/stickers', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    await getPackOrThrow(db, req.params.id);
    const rows = await toPromise(tableSticker.list, db, {
      includeDeleted: parseBoolean(req.query.includeDeleted, false),
      packId: req.params.id,
      status: normalizeString(req.query.status, { maxLength: 32, allowEmpty: true }),
      searchVisible: req.query.searchVisible === undefined ? undefined : parseBoolean(req.query.searchVisible, true),
      query: normalizeString(req.query.q, { maxLength: 120, allowEmpty: true }),
      limit: parseInteger(req.query.limit, 200, { min: 1, max: 500 }),
      offset: parseInteger(req.query.offset, 0, { min: 0, max: 100000 })
    });
    res.status(200).json({ status: 200, rows: rows.map(toStickerDto) });
  } catch (err) {
    next(err);
  }
});

router.get('/stickers', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const rows = await toPromise(tableSticker.list, db, {
      includeDeleted: parseBoolean(req.query.includeDeleted, false),
      categoryId: normalizeString(req.query.categoryId, { maxLength: 120, allowEmpty: true }),
      packId: normalizeString(req.query.packId, { maxLength: 120, allowEmpty: true }),
      status: normalizeString(req.query.status, { maxLength: 32, allowEmpty: true }),
      searchVisible: req.query.searchVisible === undefined ? undefined : parseBoolean(req.query.searchVisible, true),
      query: normalizeString(req.query.q, { maxLength: 120, allowEmpty: true }),
      limit: parseInteger(req.query.limit, 200, { min: 1, max: 500 }),
      offset: parseInteger(req.query.offset, 0, { min: 0, max: 100000 })
    });
    res.status(200).json({ status: 200, rows: rows.map(toStickerDto) });
  } catch (err) {
    next(err);
  }
});

router.get('/stickers/:id', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const row = await getStickerOrThrow(db, req.params.id);
    res.status(200).json({ status: 200, row: toStickerDto(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/search', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const rows = await toPromise(tableSticker.list, db, {
      includeDeleted: false,
      status: 'active',
      searchVisible: true,
      categoryId: normalizeString(req.query.categoryId, { maxLength: 120, allowEmpty: true }),
      query: normalizeString(req.query.q, { maxLength: 120, allowEmpty: true }),
      limit: parseInteger(req.query.limit, 100, { min: 1, max: 200 }),
      offset: 0
    });
    res.status(200).json({ status: 200, rows: rows.map(toStickerDto) });
  } catch (err) {
    next(err);
  }
});

router.get('/settings', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const row = await toPromise(tableStickerSettings.get, db);
    res.status(200).json({ status: 200, row: toSettingsDto(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/render/:stickerId', requireIssuer(READER_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const variant = normalizeString(req.query.variant, { maxLength: 16, allowEmpty: true, fallback: 'chat' }) || 'chat';
    if (!VALID_VARIANTS.has(variant)) {
      throw buildError(400, 'invalid_render_variant');
    }

    const resolved = await resolveRenderableStickerAsset(db, req.params.stickerId, variant);
    if (!resolved) {
      throw buildError(404, 'sticker_asset_not_found');
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Content-Type', resolved.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(resolved.relativePath)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Resolved-Sticker-Id', resolved.sticker.id);
    res.setHeader('X-Sticker-Fallback', resolved.isFallback ? '1' : '0');
    res.sendFile(resolved.filePath);
  } catch (err) {
    next(err);
  }
});

router.post('/admin/categories', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const payload = await createCategoryPayload(db, req.body);
    await toPromise(tableStickerCategory.create, db, payload);
    const row = await getCategoryOrThrow(db, payload.id);
    res.status(201).json({ status: 201, row: toCategoryDto(row) });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/categories/:id', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const existing = await getCategoryOrThrow(db, req.params.id);
    const payload = await createCategoryPayload(db, req.body, { existing });
    await toPromise(tableStickerCategory.update, db, existing.id, payload);
    const row = await getCategoryOrThrow(db, existing.id);
    res.status(200).json({ status: 200, row: toCategoryDto(row) });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/categories/:id', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const category = await getCategoryOrThrow(db, req.params.id);
    await toPromise(tableStickerCategory.markDeleted, db, category.id);
    await toPromise(tableStickerPack.markDeletedByCategory, db, category.id);
    await toPromise(tableSticker.markDeletedByCategory, db, category.id);
    const row = await getCategoryOrThrow(db, category.id);
    res.status(200).json({ status: 200, row: toCategoryDto(row), deleted: true });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/packs', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const payload = await createPackPayload(db, req.body);
    await toPromise(tableStickerPack.create, db, payload);
    const row = await getPackOrThrow(db, payload.id);
    res.status(201).json({ status: 201, row: toPackDto(row) });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/packs/:id', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const existing = await getPackOrThrow(db, req.params.id);
    const payload = await createPackPayload(db, req.body, { existing });
    await toPromise(tableStickerPack.update, db, existing.id, payload);
    const row = await getPackOrThrow(db, existing.id);
    res.status(200).json({ status: 200, row: toPackDto(row) });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/packs/:id', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const pack = await getPackOrThrow(db, req.params.id);
    await toPromise(tableStickerPack.markDeleted, db, pack.id);
    await toPromise(tableSticker.markDeletedByPack, db, pack.id);
    const row = await getPackOrThrow(db, pack.id);
    res.status(200).json({ status: 200, row: toPackDto(row), deleted: true });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/stickers', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const payload = await createStickerPayload(db, req.body);
    await toPromise(tableSticker.create, db, payload);
    const row = await getStickerOrThrow(db, payload.id);
    res.status(201).json({ status: 201, row: toStickerDto(row) });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/flaticon/resolve', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const sourceUrl = normalizeString(req.body?.sourceUrl || req.body?.url, { maxLength: 2000 });
    if (!sourceUrl) {
      throw buildError(400, 'source_url_required');
    }
    const result = await resolveFlaticonPackMetadata(sourceUrl);
    res.status(200).json({
      status: 200,
      sourceProvider: 'flaticon',
      metadata: result.metadata,
      suggested: result.suggested
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/packs/:packId/stickers/bulk-upsert', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    await getPackOrThrow(db, req.params.packId);
    const stickers = Array.isArray(req.body?.stickers) ? req.body.stickers : [];
    if (stickers.length === 0) {
      throw buildError(400, 'stickers_required');
    }
    if (stickers.length > 500) {
      throw buildError(413, 'too_many_stickers');
    }

    const rows = [];
    for (const item of stickers) {
      const requestedId = normalizeString(item?.id, { maxLength: 120, allowEmpty: true });
      const existing = requestedId ? await toPromise(tableSticker.getById, db, requestedId) : null;
      const payload = await createStickerPayload(db, { ...item, id: requestedId }, { existing, forcedPackId: req.params.packId });
      if (existing) {
        await toPromise(tableSticker.update, db, existing.id, payload);
        rows.push(await getStickerOrThrow(db, existing.id));
      } else {
        await toPromise(tableSticker.create, db, payload);
        rows.push(await getStickerOrThrow(db, payload.id));
      }
    }

    res.status(200).json({ status: 200, rows: rows.map(toStickerDto) });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/packs/:packId/import-svg', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const pack = await getPackOrThrow(db, req.params.packId);
    if (String(pack.status || '').toLowerCase() === 'deleted') {
      throw buildError(409, 'sticker_pack_deleted');
    }

    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (files.length === 0) {
      throw buildError(400, 'svg_files_required');
    }
    if (files.length > 500) {
      throw buildError(413, 'too_many_files');
    }

    const rows = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const entry of files) {
      const input = normalizeObject(entry);
      if (!input) {
        throw buildError(400, 'invalid_file_payload');
      }

      const fileName = normalizeSvgFileName(input.fileName || input.name);
      const slugSource = fileName.replace(/\.svg$/i, '').replace(/[-_]+/g, ' ').trim();
      const slug = normalizeSlug(input.name || slugSource, slugSource || 'sticker');
      const displayName = normalizeString(input.name, { maxLength: 120, allowEmpty: true }) || slugSource || 'Sticker';
      const mimeType = normalizeMimeType(input.mimeType || 'image/svg+xml') || 'image/svg+xml';
      if (!/image\/svg\+xml/i.test(mimeType) && !/\.svg$/i.test(fileName)) {
        throw buildError(400, 'invalid_svg_file');
      }

      const sanitizedSvg = sanitizeSvgMarkup(decodeBase64Utf8(input.contentBase64));
      const storedPaths = await writeStickerSvgFiles(pack.id, fileName, sanitizedSvg);
      const existing = await toPromise(tableSticker.getByPackAndSlug, db, pack.id, slug);

      const payload = await createStickerPayload(db, {
        id: existing?.id || normalizeString(input.id, { maxLength: 120, allowEmpty: true }),
        name: displayName,
        slug,
        keywords: Array.isArray(input.keywords) ? input.keywords : slugSource.split(/\s+/).filter(Boolean),
        previewPath: storedPaths.previewPath,
        previewMimeType: 'image/svg+xml',
        chatPath: storedPaths.chatPath,
        chatMimeType: 'image/svg+xml',
        originalPath: storedPaths.originalPath,
        originalMimeType: 'image/svg+xml',
        width: input.width,
        height: input.height,
        searchVisible: input.searchVisible ?? true,
        status: input.status || 'active',
        sortOrder: input.sortOrder ?? existing?.sortOrder ?? 0
      }, { existing, forcedPackId: pack.id });

      if (existing) {
        await toPromise(tableSticker.update, db, existing.id, payload);
        rows.push(await getStickerOrThrow(db, existing.id));
        updatedCount += 1;
      } else {
        await toPromise(tableSticker.create, db, payload);
        rows.push(await getStickerOrThrow(db, payload.id));
        createdCount += 1;
      }
    }

    res.status(200).json({
      status: 200,
      createdCount,
      updatedCount,
      rows: rows.map(toStickerDto)
    });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/stickers/:id', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const existing = await getStickerOrThrow(db, req.params.id);
    const payload = await createStickerPayload(db, req.body, { existing });
    await toPromise(tableSticker.update, db, existing.id, payload);
    const row = await getStickerOrThrow(db, existing.id);
    res.status(200).json({ status: 200, row: toStickerDto(row) });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/stickers/:id', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const sticker = await getStickerOrThrow(db, req.params.id);
    await toPromise(tableSticker.markDeleted, db, sticker.id);
    const row = await getStickerOrThrow(db, sticker.id);
    res.status(200).json({ status: 200, row: toStickerDto(row), deleted: true });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/settings', requireIssuer(ADMIN_ISSUERS), async (req, res, next) => {
  try {
    const db = getDatabase(req);
    const notFoundStickerId = normalizeString(req.body?.notFoundStickerId, { maxLength: 120, allowEmpty: true }) || null;
    if (notFoundStickerId) {
      await ensureStickerReferenceValid(db, notFoundStickerId, { allowEmpty: false, allowDeleted: false });
    }
    await toPromise(tableStickerSettings.update, db, {
      notFoundStickerId,
      updatedAt: Date.now()
    });
    const row = await toPromise(tableStickerSettings.get, db);
    res.status(200).json({ status: 200, row: toSettingsDto(row) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
