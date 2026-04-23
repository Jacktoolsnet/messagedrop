// routes/weather.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const { resolveOpenMeteoProxyTimeoutMs } = require('../utils/openmeteo-timeout');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

// Axios-Client für Upstream
const openMeteoBase = resolveBaseUrl(process.env.OPENMETEO_BASE_URL, process.env.OPENMETEO_PORT);
const openMeteoProxyTimeoutMs = resolveOpenMeteoProxyTimeoutMs();
const client = axios.create({
    baseURL: `${openMeteoBase}/weather`,
    timeout: openMeteoProxyTimeoutMs,
    validateStatus: () => true, // wir geben Statuscodes transparent weiter
    headers: {
        'content-type': 'application/json'
    }
});

function buildUpstreamError(err) {
    const status = err?.response?.status || (isTimeoutError(err) ? 504 : 502);
    const apiErr = apiError.fromStatus(status);
    apiErr.detail = err?.response?.data || err?.message || null;
    return apiErr;
}

function isTimeoutError(err) {
    return err?.code === 'ECONNABORTED'
        || String(err?.message || '').toLowerCase().includes('timeout');
}

function buildForwardHeaders(req, token) {
    return {
        Authorization: `Bearer ${token}`,
        'x-forwarded-host': req.get('host'),
        'x-forwarded-proto': req.protocol,
        'x-trace-id': req.traceId,
        'x-request-id': req.traceId,
    };
}

// GET /weather/:locale/:pluscode/:latitude/:longitude/:days
router.get('/:locale/:pluscode/:latitude/:longitude/:days', [
    metric.count('weather', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
    const { locale, pluscode, latitude, longitude, days } = req.params;

    try {
        // Pfad im OpenMeteo-Service ggf. anpassen (z. B. '/openmeteo/weather/...').
        const url = `/${encodeURIComponent(locale)}/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}/${encodeURIComponent(days)}`;

        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_OPENMETEO || 'service.openmeteo'
        });
        const upstream = await client.get(url, {
            params: req.query, // Querystrings mit durchreichen (z. B. flags)
            headers: buildForwardHeaders(req, token),
        });

        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        req.logger.error('[weather.proxy] upstream error', {
            message: err?.message || null,
            code: err?.code || null,
            status: err?.response?.status || null,
            timeout: isTimeoutError(err),
            url: err?.config?.url || null,
            baseURL: err?.config?.baseURL || null,
            timeoutMs: openMeteoProxyTimeoutMs
        });
        return next(buildUpstreamError(err));
    }
});

// GET /weather/history/:pluscode/:latitude/:longitude/:years
router.get('/history/:pluscode/:latitude/:longitude/:years', [
    metric.count('weather.history', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
    const { pluscode, latitude, longitude, years } = req.params;

    try {
        const url = `/history/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}/${encodeURIComponent(years)}`;

        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_OPENMETEO || 'service.openmeteo'
        });
        const upstream = await client.get(url, {
            params: req.query,
            headers: buildForwardHeaders(req, token),
        });

        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        req.logger.error('[weather.proxy.history] upstream error', {
            message: err?.message || null,
            code: err?.code || null,
            status: err?.response?.status || null,
            timeout: isTimeoutError(err),
            url: err?.config?.url || null,
            baseURL: err?.config?.baseURL || null,
            timeoutMs: openMeteoProxyTimeoutMs
        });
        return next(buildUpstreamError(err));
    }
});

module.exports = router;
