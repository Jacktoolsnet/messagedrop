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

function handleKlipyError(err, next) {
    const apiErr = apiError.badGateway('klipy_unavailable');
    apiErr.detail = err?.message || err;
    next(apiErr);
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
    // Older Tenor-compatible experiments used /v2. The official KLIPY API lives under /api/v1/{app_key}.
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

function buildGifSearchParams(req, page, searchTerm = '') {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(resolvePerPage()));
    params.set('locale', normalizeLocale(req.params.country));
    params.set('content_filter', process.env.KLIPY_CONTENT_FILTER || 'low');
    params.set('format_filter', process.env.KLIPY_FORMAT_FILTER || 'gif,webp,jpg,mp4,webm');
    if (searchTerm && searchTerm.trim()) {
        params.set('q', searchTerm.trim());
    }
    return params;
}

function firstFormat(...formats) {
    for (const format of formats) {
        if (format?.url) {
            return format;
        }
    }
    return undefined;
}

function buildItemUrl(item) {
    const slug = typeof item?.slug === 'string' ? item.slug.trim() : '';
    if (slug) {
        return `https://klipy.com/gifs/${encodeURIComponent(slug)}`;
    }
    return 'https://klipy.com/';
}

function normalizeKlipyItem(item) {
    const file = item?.file || {};
    const gif = firstFormat(file.md?.gif, file.hd?.gif, file.sm?.gif, file.xs?.gif, file.md?.webp, file.hd?.webp);
    const tinygif = firstFormat(file.xs?.gif, file.sm?.gif, file.xs?.webp, file.sm?.webp, gif);
    const fallbackUrl = gif?.url || tinygif?.url || item?.blur_preview || '';

    return {
        id: String(item?.id ?? item?.slug ?? fallbackUrl),
        itemurl: buildItemUrl(item),
        title: String(item?.title || ''),
        content_description: String(item?.title || ''),
        media_formats: {
            gif: { url: fallbackUrl },
            tinygif: { url: tinygif?.url || fallbackUrl }
        },
        klipy: {
            slug: item?.slug || '',
            type: item?.type || 'gif',
            blur_preview: item?.blur_preview || ''
        }
    };
}

function normalizeKlipyResponse(payload) {
    const data = payload?.data || {};
    const rows = Array.isArray(data.data) ? data.data : [];
    const currentPage = parsePage(data.current_page);
    const hasNext = data.has_next === true;

    return {
        results: rows
            .map(normalizeKlipyItem)
            .filter((item) => item.media_formats.gif.url),
        next: hasNext ? String(currentPage + 1) : ''
    };
}

async function proxyKlipyGifSearch(req, res, next, page, searchTerm = '') {
    const appKey = process.env.KLIPY_API_KEY;
    if (!appKey || !appKey.trim()) {
        return next(apiError.serviceUnavailable('klipy_api_key_missing'));
    }

    const response = { status: 0 };
    const axiosClient = buildKlipyClient();
    const params = buildGifSearchParams(req, page, searchTerm);
    const endpoint = `/api/v1/${encodeURIComponent(appKey.trim())}/gifs/search`;

    try {
        const klipyResponse = await axiosClient.get(endpoint, { params });
        response.status = klipyResponse.status;
        response.data = normalizeKlipyResponse(klipyResponse.data);
        return res.status(klipyResponse.status).send(response);
    } catch (err) {
        req.logger?.error?.('Klipy request failed', { error: err?.message || err });
        return handleKlipyError(err, next);
    }
}

router.get('/featured/:country/:locale',
    [
        metric.count('klipy.featured', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => proxyKlipyGifSearch(req, res, next, 1));

router.get('/featured/:country/:locale/:next',
    [
        metric.count('klipy.featured', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => proxyKlipyGifSearch(req, res, next, parsePage(req.params.next)));

router.get('/search/:country/:locale/:searchTerm',
    [
        metric.count('klipy.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => proxyKlipyGifSearch(req, res, next, 1, req.params.searchTerm));

router.get('/search/:country/:locale/:searchTerm/:next',
    [
        metric.count('klipy.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => proxyKlipyGifSearch(req, res, next, parsePage(req.params.next), req.params.searchTerm));

module.exports = router;
