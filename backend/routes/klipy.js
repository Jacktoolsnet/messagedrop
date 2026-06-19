const express = require('express');
const router = express.Router();
const axios = require('axios');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

const DEFAULT_KLIPY_BASE_URL = 'https://api.klipy.com/v2';
const DEFAULT_TIMEOUT_MS = 5000;

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

function buildKlipyClient() {
    return axios.create({
        baseURL: process.env.KLIPY_BASE_URL || DEFAULT_KLIPY_BASE_URL,
        timeout: resolveTimeoutMs()
    });
}

function buildCommonParams(req) {
    const params = new URLSearchParams();
    params.set('key', process.env.KLIPY_API_KEY);
    if (process.env.KLIPY_CLIENT_KEY) {
        params.set('client_key', process.env.KLIPY_CLIENT_KEY);
    }
    params.set('media_filter', 'gif,tinygif');
    params.set('ar_range', 'standard');
    params.set('contentfilter', 'low');
    params.set('limit', '30');
    params.set('country', req.params.country);
    params.set('locale', req.params.locale);
    return params;
}

async function proxyKlipyRequest(req, res, next, endpoint, params) {
    const response = { status: 0 };
    const axiosClient = buildKlipyClient();

    try {
        const klipyResponse = await axiosClient.get(endpoint, { params });
        response.status = klipyResponse.status;
        response.data = klipyResponse.data;
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
    , async (req, res, next) => {
        const params = buildCommonParams(req);
        return proxyKlipyRequest(req, res, next, '/featured', params);
    });

router.get('/featured/:country/:locale/:next',
    [
        metric.count('klipy.featured', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => {
        const params = buildCommonParams(req);
        params.set('pos', req.params.next);
        return proxyKlipyRequest(req, res, next, '/featured', params);
    });

router.get('/search/:country/:locale/:searchTerm',
    [
        metric.count('klipy.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => {
        const params = buildCommonParams(req);
        params.set('q', req.params.searchTerm);
        return proxyKlipyRequest(req, res, next, '/search', params);
    });

router.get('/search/:country/:locale/:searchTerm/:next',
    [
        metric.count('klipy.search', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res, next) => {
        const params = buildCommonParams(req);
        params.set('q', req.params.searchTerm);
        params.set('pos', req.params.next);
        return proxyKlipyRequest(req, res, next, '/search', params);
    });

module.exports = router;
