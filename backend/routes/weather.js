// routes/weather.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

// Axios-Client für Upstream
const client = axios.create({
    baseURL: `${process.env.OPENMETEO_BASE_URL}:${process.env.OPENMETEO_PORT}/weather`,
    timeout: 5000,
    validateStatus: () => true, // wir geben Statuscodes transparent weiter
    headers: {
        'content-type': 'application/json'
    }
});

function buildUpstreamError(err) {
    const status = err?.response?.status || 502;
    const apiErr = apiError.fromStatus(status);
    apiErr.detail = err?.response?.data || err?.message || null;
    return apiErr;
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
            headers: {
                Authorization: `Bearer ${token}`,
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });

        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        req.logger.error('[weather.proxy] upstream error:', err?.message || err);
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
            headers: {
                Authorization: `Bearer ${token}`,
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });

        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        req.logger.error('[weather.proxy.history] upstream error:', err?.message || err);
        return next(buildUpstreamError(err));
    }
});

module.exports = router;
