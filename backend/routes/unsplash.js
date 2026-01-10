const express = require('express');
const router = express.Router();
const axios = require('axios');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

const PER_PAGE = 30;

function normalizePage(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function createUnsplashClient() {
    return axios.create({
        baseURL: process.env.UNSPLASH_BASE_URL,
        timeout: 5000,
        headers: {
            Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
            'Accept-Version': 'v1'
        }
    });
}

function handleUnsplashError(err, next) {
    const apiErr = apiError.badGateway('unsplash_unavailable');
    apiErr.detail = err?.message || err;
    next(apiErr);
}

function buildFeaturedParams(page) {
    const params = new URLSearchParams();
    params.set('order_by', 'popular');
    params.set('page', String(page));
    params.set('per_page', String(PER_PAGE));
    return params;
}

function buildSearchParams(query, page, topics) {
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('page', String(page));
    params.set('per_page', String(PER_PAGE));
    if (typeof topics === 'string' && topics.trim()) {
        params.set('topics', topics.trim());
    }
    return params;
}

function buildTopicParams(page) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(PER_PAGE));
    params.set('order_by', 'popular');
    return params;
}

function getUnsplashBaseUrl() {
    const base = process.env.UNSPLASH_BASE_URL;
    if (!base) {
        return null;
    }
    try {
        return new URL(base);
    } catch {
        return null;
    }
}

function isAllowedDownloadLocation(downloadLocation) {
    try {
        const url = new URL(downloadLocation);
        const baseUrl = getUnsplashBaseUrl();
        if (baseUrl) {
            return url.protocol === baseUrl.protocol && url.host === baseUrl.host;
        }
        return url.host === 'api.unsplash.com';
    } catch {
        return false;
    }
}

router.get('/featured',
    [
        metric.count('unsplash.featured', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => {
        const response = { status: 0 };
        const params = buildFeaturedParams(1);
        const axiosClient = createUnsplashClient();

        try {
            const unsplashResponse = await axiosClient.get('/photos', { params });
            response.status = unsplashResponse.status;
            response.data = unsplashResponse.data;
            return res.status(unsplashResponse.status).send(response);
        } catch (err) {
            req.logger?.error?.('Unsplash request failed', { error: err?.message || err });
            return handleUnsplashError(err, next);
        }
    });

router.get('/featured/:page',
    [
        metric.count('unsplash.featured', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => {
        const response = { status: 0 };
        const params = buildFeaturedParams(normalizePage(req.params.page));
        const axiosClient = createUnsplashClient();

        try {
            const unsplashResponse = await axiosClient.get('/photos', { params });
            response.status = unsplashResponse.status;
            response.data = unsplashResponse.data;
            return res.status(unsplashResponse.status).send(response);
        } catch (err) {
            req.logger?.error?.('Unsplash request failed', { error: err?.message || err });
            return handleUnsplashError(err, next);
        }
    });

router.get('/search/:searchTerm',
    [
        metric.count('unsplash.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => {
        const response = { status: 0 };
        const params = buildSearchParams(req.params.searchTerm, 1, req.query?.topics);
        const axiosClient = createUnsplashClient();

        try {
            const unsplashResponse = await axiosClient.get('/search/photos', { params });
            response.status = unsplashResponse.status;
            response.data = unsplashResponse.data;
            return res.status(unsplashResponse.status).send(response);
        } catch (err) {
            req.logger?.error?.('Unsplash request failed', { error: err?.message || err });
            return handleUnsplashError(err, next);
        }
    });

router.get('/search/:searchTerm/:page',
    [
        metric.count('unsplash.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => {
        const response = { status: 0 };
        const params = buildSearchParams(req.params.searchTerm, normalizePage(req.params.page), req.query?.topics);
        const axiosClient = createUnsplashClient();

        try {
            const unsplashResponse = await axiosClient.get('/search/photos', { params });
            response.status = unsplashResponse.status;
            response.data = unsplashResponse.data;
            return res.status(unsplashResponse.status).send(response);
        } catch (err) {
            req.logger?.error?.('Unsplash request failed', { error: err?.message || err });
            return handleUnsplashError(err, next);
        }
    });

router.get('/topic/:topic',
    [
        metric.count('unsplash.topic', { when: 'always', timezone: 'utc', amount: 1 })
    ],
    async (req, res, next) => {
        const response = { status: 0 };
        const params = buildTopicParams(1);
        const axiosClient = createUnsplashClient();

        try {
            const topic = encodeURIComponent(req.params.topic);
            const unsplashResponse = await axiosClient.get(`/topics/${topic}/photos`, { params });
            response.status = unsplashResponse.status;
            response.data = unsplashResponse.data;
            return res.status(unsplashResponse.status).send(response);
        } catch (err) {
            req.logger?.error?.('Unsplash topic request failed', { error: err?.message || err });
            return handleUnsplashError(err, next);
        }
    });

router.get('/topic/:topic/:page',
    [
        metric.count('unsplash.topic', { when: 'always', timezone: 'utc', amount: 1 })
    ],
    async (req, res, next) => {
        const response = { status: 0 };
        const params = buildTopicParams(normalizePage(req.params.page));
        const axiosClient = createUnsplashClient();

        try {
            const topic = encodeURIComponent(req.params.topic);
            const unsplashResponse = await axiosClient.get(`/topics/${topic}/photos`, { params });
            response.status = unsplashResponse.status;
            response.data = unsplashResponse.data;
            return res.status(unsplashResponse.status).send(response);
        } catch (err) {
            req.logger?.error?.('Unsplash topic request failed', { error: err?.message || err });
            return handleUnsplashError(err, next);
        }
    });

router.post('/download',
    [
        express.json({ limit: '64kb' }),
        metric.count('unsplash.download', { when: 'always', timezone: 'utc', amount: 1 })
    ],
    async (req, res, next) => {
        const downloadLocation = typeof req.body?.downloadLocation === 'string'
            ? req.body.downloadLocation.trim()
            : typeof req.body?.download_location === 'string'
                ? req.body.download_location.trim()
                : '';

        if (!downloadLocation) {
            return next(apiError.badRequest('invalid_download_location'));
        }

        if (!isAllowedDownloadLocation(downloadLocation)) {
            return next(apiError.badRequest('download_location_not_allowed'));
        }

        const response = { status: 0 };
        const axiosClient = createUnsplashClient();

        try {
            const unsplashResponse = await axiosClient.get(downloadLocation);
            response.status = unsplashResponse.status;
            response.data = unsplashResponse.data;
            return res.status(unsplashResponse.status).send(response);
        } catch (err) {
            req.logger?.error?.('Unsplash download tracking failed', { error: err?.message || err });
            return handleUnsplashError(err, next);
        }
    });

module.exports = router;
