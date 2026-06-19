const express = require('express');
const router = express.Router();
const axios = require('axios');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

const DEFAULT_KLIPY_BASE_URL = 'https://api.klipy.com';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_PER_PAGE = 30;
const MIN_PER_PAGE = 8;
const MAX_PER_PAGE = 50;

const KIND_CONFIG = {
    gif: {
        apiPath: 'gifs',
        slugPath: 'gifs',
        type: 'gif',
        formatFilter: true,
        defaultFormatFilter: 'gif,webp,jpg,mp4,webm',
        envFormatFilter: 'KLIPY_GIF_FORMAT_FILTER',
        allowedFormats: ['gif', 'webp', 'jpg', 'mp4', 'webm']
    },
    sticker: {
        apiPath: 'stickers',
        slugPath: 'stickers',
        type: 'sticker',
        formatFilter: true,
        defaultFormatFilter: 'gif,webp,png,webm',
        envFormatFilter: 'KLIPY_STICKER_FORMAT_FILTER',
        allowedFormats: ['gif', 'webp', 'png', 'webm']
    },
    clip: { apiPath: 'clips', slugPath: 'clips', type: 'clip', formatFilter: false },
    meme: { apiPath: 'static-memes', slugPath: 'memes', type: 'meme', formatFilter: false }
};

function handleKlipyError(err, next) {
    const apiErr = apiError.badGateway('klipy_unavailable');
    apiErr.detail = err?.message || err;
    next(apiErr);
}

function resolveKind(value) {
    const normalized = String(value || 'gif').trim().toLowerCase();
    return KIND_CONFIG[normalized] ? normalized : '';
}

function resolveTimeoutMs() {
    const configured = Number(process.env.KLIPY_API_TIMEOUT_MS);
    if (!Number.isFinite(configured) || configured <= 0) {
        return DEFAULT_TIMEOUT_MS;
    }
    return Math.round(configured);
}

function normalizeBaseUrl(value) {
    const raw = String(value || DEFAULT_KLIPY_BASE_URL).trim().replace(/\/+$/, '');
    if (!raw) return DEFAULT_KLIPY_BASE_URL;
    return raw.replace(/\/v2$/i, '');
}

function buildKlipyClient() {
    return axios.create({
        baseURL: normalizeBaseUrl(process.env.KLIPY_BASE_URL),
        timeout: resolveTimeoutMs()
    });
}

function parsePage(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function resolvePerPage() {
    const configured = Number.parseInt(process.env.KLIPY_PER_PAGE || '', 10);
    if (!Number.isFinite(configured)) {
        return DEFAULT_PER_PAGE;
    }
    return Math.min(MAX_PER_PAGE, Math.max(MIN_PER_PAGE, configured));
}

function normalizeLocale(country) {
    return String(country || '').trim().toLowerCase() || 'us';
}

function resolveFormatFilter(kind) {
    const config = KIND_CONFIG[kind];
    const kindSpecific = String(process.env[config.envFormatFilter] || '').trim();
    const configured = kindSpecific || (kind === 'gif' ? String(process.env.KLIPY_FORMAT_FILTER || '').trim() : '');
    if (!configured) {
        return config.defaultFormatFilter;
    }

    const formats = configured
        .split(',')
        .map((format) => format.trim().toLowerCase())
        .filter((format, index, list) => format && list.indexOf(format) === index)
        .filter((format) => config.allowedFormats.includes(format));

    return formats.length > 0 ? formats.join(',') : config.defaultFormatFilter;
}

function buildRequestParams(req, kind, page, searchTerm = '') {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(resolvePerPage()));
    params.set('locale', normalizeLocale(req.params.country));
    params.set('content_filter', process.env.KLIPY_CONTENT_FILTER || 'low');
    if (KIND_CONFIG[kind].formatFilter) {
        params.set('format_filter', resolveFormatFilter(kind));
    }
    if (searchTerm && searchTerm.trim()) {
        params.set('q', searchTerm.trim());
    }
    return params;
}

function asFormat(value) {
    if (typeof value === 'string' && value.trim()) {
        return { url: value.trim() };
    }
    if (value?.url) {
        return value;
    }
    return undefined;
}

function firstFormat(...formats) {
    for (const format of formats) {
        const normalized = asFormat(format);
        if (normalized?.url) {
            return normalized;
        }
    }
    return undefined;
}

function buildItemUrl(item, kind) {
    const slug = typeof item?.slug === 'string' ? item.slug.trim() : '';
    if (slug) {
        return `https://klipy.com/${KIND_CONFIG[kind].slugPath}/${encodeURIComponent(slug)}`;
    }
    return 'https://klipy.com/';
}

function pickPrimaryImage(file) {
    return firstFormat(
        file.md?.gif, file.md?.webp, file.md?.jpg, file.md?.png,
        file.hd?.gif, file.hd?.webp, file.hd?.jpg, file.hd?.png,
        file.sm?.gif, file.sm?.webp, file.sm?.jpg, file.sm?.png,
        file.xs?.gif, file.xs?.webp, file.xs?.jpg, file.xs?.png,
        file.gif, file.webp, file.jpg, file.png
    );
}

function pickPreviewImage(file) {
    return firstFormat(
        file.xs?.webp, file.xs?.gif, file.xs?.jpg, file.xs?.png,
        file.sm?.webp, file.sm?.gif, file.sm?.jpg, file.sm?.png,
        file.md?.webp, file.md?.gif, file.md?.jpg, file.md?.png,
        file.webp, file.gif, file.jpg, file.png
    );
}

function pickPrimaryVideo(file) {
    return firstFormat(
        file.md?.mp4, file.hd?.mp4, file.sm?.mp4, file.xs?.mp4,
        file.md?.webm, file.hd?.webm, file.sm?.webm, file.xs?.webm,
        file.mp4, file.webm
    );
}

function pickPreviewVideo(file) {
    return firstFormat(
        file.xs?.mp4, file.sm?.mp4, file.xs?.webm, file.sm?.webm,
        file.md?.mp4, file.md?.webm, file.mp4, file.webm
    );
}

function normalizeKlipyItem(item, kind) {
    const file = item?.file || {};
    const isClip = kind === 'clip';
    const primary = isClip ? pickPrimaryVideo(file) : pickPrimaryImage(file);
    const preview = isClip ? (pickPreviewVideo(file) || pickPreviewImage(file)) : pickPreviewImage(file);
    const poster = pickPreviewImage(file);
    const fallbackUrl = primary?.url || preview?.url || poster?.url || item?.blur_preview || '';

    return {
        id: String(item?.id ?? item?.slug ?? fallbackUrl),
        itemurl: buildItemUrl(item, kind),
        title: String(item?.title || ''),
        content_description: String(item?.title || ''),
        media_kind: KIND_CONFIG[kind].type,
        media_formats: {
            gif: { url: fallbackUrl },
            tinygif: { url: preview?.url || fallbackUrl },
            mp4: { url: firstFormat(file.md?.mp4, file.hd?.mp4, file.sm?.mp4, file.xs?.mp4, file.mp4)?.url || '' },
            webm: { url: firstFormat(file.md?.webm, file.hd?.webm, file.sm?.webm, file.xs?.webm, file.webm)?.url || '' },
            jpg: { url: poster?.url || '' },
            webp: { url: firstFormat(file.md?.webp, file.hd?.webp, file.sm?.webp, file.xs?.webp, file.webp)?.url || '' }
        },
        klipy: {
            slug: item?.slug || '',
            type: item?.type || KIND_CONFIG[kind].type,
            media_kind: KIND_CONFIG[kind].type,
            blur_preview: item?.blur_preview || ''
        }
    };
}

function normalizeKlipyResponse(payload, kind) {
    const data = payload?.data || {};
    const rows = Array.isArray(data.data) ? data.data : [];
    const currentPage = parsePage(data.current_page);
    const hasNext = data.has_next === true;

    return {
        results: rows
            .map((item) => normalizeKlipyItem(item, kind))
            .filter((item) => item.media_formats.gif.url),
        next: hasNext ? String(currentPage + 1) : ''
    };
}

async function proxyKlipySearch(req, res, next, kind, mode, page, searchTerm = '') {
    const resolvedKind = resolveKind(kind);
    if (!resolvedKind) {
        return next(apiError.badRequest('invalid_klipy_kind'));
    }

    const appKey = process.env.KLIPY_API_KEY;
    if (!appKey || !appKey.trim()) {
        return next(apiError.serviceUnavailable('klipy_api_key_missing'));
    }

    const response = { status: 0 };
    const axiosClient = buildKlipyClient();
    const params = buildRequestParams(req, resolvedKind, page, searchTerm);
    const apiMode = mode === 'trending' ? 'trending' : 'search';
    const endpoint = `/api/v1/${encodeURIComponent(appKey.trim())}/${KIND_CONFIG[resolvedKind].apiPath}/${apiMode}`;

    try {
        const klipyResponse = await axiosClient.get(endpoint, { params });
        response.status = klipyResponse.status;
        response.data = normalizeKlipyResponse(klipyResponse.data, resolvedKind);
        return res.status(klipyResponse.status).send(response);
    } catch (err) {
        req.logger?.error?.('Klipy request failed', { kind: resolvedKind, mode: apiMode, error: err?.message || err });
        return handleKlipyError(err, next);
    }
}

// Legacy GIF routes used by existing clients.
router.get('/featured/:country/:locale',
    [metric.count('klipy.featured', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, 'gif', 'trending', 1));

router.get('/featured/:country/:locale/:next',
    [metric.count('klipy.featured', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, 'gif', 'trending', parsePage(req.params.next)));

router.get('/search/:country/:locale/:searchTerm',
    [metric.count('klipy.search', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, 'gif', 'search', 1, req.params.searchTerm));

router.get('/search/:country/:locale/:searchTerm/:next',
    [metric.count('klipy.search', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, 'gif', 'search', parsePage(req.params.next), req.params.searchTerm));

// Generic media routes.
router.get('/:kind/featured/:country/:locale',
    [metric.count('klipy.kind.featured', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, req.params.kind, 'trending', 1));

router.get('/:kind/featured/:country/:locale/:next',
    [metric.count('klipy.kind.featured', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, req.params.kind, 'trending', parsePage(req.params.next)));

router.get('/:kind/search/:country/:locale/:searchTerm',
    [metric.count('klipy.kind.search', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, req.params.kind, 'search', 1, req.params.searchTerm));

router.get('/:kind/search/:country/:locale/:searchTerm/:next',
    [metric.count('klipy.kind.search', { when: 'always', timezone: 'utc', amount: 1 })],
    async (req, res, next) => proxyKlipySearch(req, res, next, req.params.kind, 'search', parsePage(req.params.next), req.params.searchTerm));

module.exports = router;
