// routes/nominatim.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

function normalizeBaseUrl(base) {
    if (!base) return null;
    const trimmed = String(base).trim().replace(/\/+$/, '');
    if (!trimmed) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
        return null;
    }
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    try {
        const parsed = new URL(withScheme);
        if (!parsed.hostname) {
            return null;
        }
    } catch {
        return null;
    }
    return withScheme;
}

// Axios-Client für Upstream
const nominatimBase = normalizeBaseUrl(
    resolveBaseUrl(process.env.NOMINATIM_BASE_URL, process.env.NOMINATIM_PORT)
);
const nominatimBaseError = nominatimBase ? null : 'NOMINATIM_BASE_URL is missing or invalid';
const client = nominatimBase ? axios.create({
    baseURL: `${nominatimBase}/nominatim`,
    timeout: 5000,
    validateStatus: () => true, // Statuscodes transparent weiterreichen
    headers: {
        'content-type': 'application/json'
    }
}) : null;

function getClientOrError(req, next) {
    if (client) {
        return client;
    }
    const err = apiError.serviceUnavailable();
    err.detail = nominatimBaseError;
    req.logger?.error?.('nominatim proxy not configured', { error: nominatimBaseError });
    next(err);
    return null;
}

function isTimeoutError(err) {
    return err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
}

function buildUpstreamError(err) {
    const status = isTimeoutError(err) ? 504 : (err?.response?.status || 502);
    const apiErr = apiError.fromStatus(status);
    apiErr.detail = err?.response?.data || err?.message || null;
    return apiErr;
}

function sendUpstreamError(req, res, err, context) {
    const apiErr = buildUpstreamError(err);
    req.logger?.warn?.(context, { status: apiErr.status, error: apiErr.detail || apiErr.message });
    return res.status(apiErr.status).json(apiErr);
}

// GET /nominatim/countryCode/:pluscode/:latitude/:longitude
router.get('/countryCode/:pluscode/:latitude/:longitude', [
    metric.count('nominatim.countrycode', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
    const { pluscode, latitude, longitude } = req.params;
    const activeClient = getClientOrError(req, next);
    if (!activeClient) {
        return;
    }
    try {
        const url = `/countryCode/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
        });
        const upstream = await activeClient.get(url, {
            params: req.query,
            headers: {
                Authorization: `Bearer ${token}`,
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });
        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            return sendUpstreamError(req, res, err, 'nominatim proxy countryCode upstream error');
        }
        return next(err);
    }
});

// GET /nominatim/search/:searchTerm/:limit
router.get('/search/:searchTerm/:limit', [
    metric.count('nominatim.search', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
    const { searchTerm, limit } = req.params;
    const activeClient = getClientOrError(req, next);
    if (!activeClient) {
        return;
    }
    try {
        const url = `/search/${encodeURIComponent(searchTerm)}/${encodeURIComponent(limit)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
        });
        const upstream = await activeClient.get(url, {
            params: req.query,
            headers: {
                Authorization: `Bearer ${token}`,
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });
        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            return sendUpstreamError(req, res, err, 'nominatim proxy search upstream error');
        }
        return next(err);
    }
});

// GET /nominatim/noboundedsearch/:searchTerm/:limit/:viewbox
router.get('/noboundedsearch/:searchTerm/:limit/:viewbox', [
    metric.count('nominatim.noboundedsearch', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
    const { searchTerm, limit, viewbox } = req.params;
    const activeClient = getClientOrError(req, next);
    if (!activeClient) {
        return;
    }
    try {
        // Achtung: viewbox enthält Kommas; sollte vom Client bereits URL-encoded sein.
        const url = `/noboundedsearch/${encodeURIComponent(searchTerm)}/${encodeURIComponent(limit)}/${encodeURIComponent(viewbox)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
        });
        const upstream = await activeClient.get(url, {
            params: req.query,
            headers: {
                Authorization: `Bearer ${token}`,
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });
        if (upstream.status === 404) {
            return res.status(200).json({ status: 200, result: [] });
        }
        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            return sendUpstreamError(req, res, err, 'nominatim proxy noboundedsearch upstream error');
        }
        return next(err);
    }
});

// GET /nominatim/boundedsearch/:searchTerm/:limit/:viewbox
router.get('/boundedsearch/:searchTerm/:limit/:viewbox', [
    metric.count('nominatim.boundedsearch', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
    const { searchTerm, limit, viewbox } = req.params;
    const activeClient = getClientOrError(req, next);
    if (!activeClient) {
        return;
    }
    try {
        const url = `/boundedsearch/${encodeURIComponent(searchTerm)}/${encodeURIComponent(limit)}/${encodeURIComponent(viewbox)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
        });
        const upstream = await activeClient.get(url, {
            params: req.query,
            headers: {
                Authorization: `Bearer ${token}`,
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });
        if (upstream.status === 404) {
            return res.status(200).json({ status: 200, result: [] });
        }
        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        if (axios.isAxiosError(err)) {
            return sendUpstreamError(req, res, err, 'nominatim proxy boundedsearch upstream error');
        }
        return next(err);
    }
});

module.exports = router;
