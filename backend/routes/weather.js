// routes/weather.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const metric = require('../middleware/metric');

// Axios-Client für Upstream
const client = axios.create({
    baseURL: `${process.env.OPENMETEO_BASE_URL}:${process.env.OPENMETEO_PORT}/weather`,
    timeout: 5000,
    validateStatus: () => true, // wir geben Statuscodes transparent weiter
    headers: {
        'content-type': 'application/json',
        'x-api-authorization': process.env.BACKEND_TOKEN
    }
});

// GET /weather/:locale/:pluscode/:latitude/:longitude/:days
router.get('/:locale/:pluscode/:latitude/:longitude/:days', [
    metric.count('weather', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res) => {
    const { locale, pluscode, latitude, longitude, days } = req.params;

    try {
        // Pfad im OpenMeteo-Service ggf. anpassen (z. B. '/openmeteo/weather/...').
        const url = `/${encodeURIComponent(locale)}/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}/${encodeURIComponent(days)}`;

        const upstream = await client.get(url, {
            params: req.query, // Querystrings mit durchreichen (z. B. flags)
            headers: {
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });

        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        req.logger.error('[weather.proxy] upstream error:', err?.message || err);
        const isAxios = !!err?.isAxiosError;
        const status = isAxios ? (err.response?.status || 502) : 500;
        const payload = isAxios
            ? (err.response?.data || { status, error: 'Upstream request failed' })
            : { status, error: 'Internal server error' };
        res.status(status).json(payload);
    }
});

// GET /weather/history/:pluscode/:latitude/:longitude/:years
router.get('/history/:pluscode/:latitude/:longitude/:years', [
    metric.count('weather.history', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res) => {
    const { pluscode, latitude, longitude, years } = req.params;

    try {
        const url = `/history/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}/${encodeURIComponent(years)}`;

        const upstream = await client.get(url, {
            params: req.query,
            headers: {
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });

        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        req.logger.error('[weather.proxy.history] upstream error:', err?.message || err);
        const isAxios = !!err?.isAxiosError;
        const status = isAxios ? (err.response?.status || 502) : 500;
        const payload = isAxios
            ? (err.response?.data || { status, error: 'Upstream request failed' })
            : { status, error: 'Internal server error' };
        res.status(status).json(payload);
    }
});

module.exports = router;
