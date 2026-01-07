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

function buildSearchParams(query, page) {
    const params = new URLSearchParams();
    params.set('query', query);
    params.set('page', String(page));
    params.set('per_page', String(PER_PAGE));
    return params;
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
        const params = buildSearchParams(req.params.searchTerm, 1);
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
        const params = buildSearchParams(req.params.searchTerm, normalizePage(req.params.page));
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

module.exports = router;
