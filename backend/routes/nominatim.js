// routes/nominatim.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const metric = require('../middleware/metric');

// Axios-Client für Upstream
const client = axios.create({
    baseURL: `${process.env.NOMINATIM_BASE_URL}:${process.env.NOMINATIM_PORT}/nominatim`,
    timeout: 5000,
    validateStatus: () => true, // Statuscodes transparent weiterreichen
    headers: {
        'content-type': 'application/json'
    }
});

// GET /nominatim/countryCode/:pluscode/:latitude/:longitude
router.get('/countryCode/:pluscode/:latitude/:longitude', [
    metric.count('nominatim.countrycode', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res) => {
    const { pluscode, latitude, longitude } = req.params;
    try {
        const url = `/countryCode/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
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
        console.error('[nominatim.proxy countryCode] upstream error:', err?.message || err);
        const status = err.response?.status || 502;
        res.status(status).json(err.response?.data || { status, error: 'Upstream request failed' });
    }
});

// GET /nominatim/search/:searchTerm/:limit
router.get('/search/:searchTerm/:limit', [
    metric.count('nominatim.search', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res) => {
    const { searchTerm, limit } = req.params;
    try {
        const url = `/search/${encodeURIComponent(searchTerm)}/${encodeURIComponent(limit)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
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
        console.error('[nominatim.proxy search] upstream error:', err?.message || err);
        const status = err.response?.status || 502;
        res.status(status).json(err.response?.data || { status, error: 'Upstream request failed' });
    }
});

// GET /nominatim/noboundedsearch/:searchTerm/:limit/:viewbox
router.get('/noboundedsearch/:searchTerm/:limit/:viewbox', [
    metric.count('nominatim.noboundedsearch', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res) => {
    const { searchTerm, limit, viewbox } = req.params;
    try {
        // Achtung: viewbox enthält Kommas; sollte vom Client bereits URL-encoded sein.
        const url = `/noboundedsearch/${encodeURIComponent(searchTerm)}/${encodeURIComponent(limit)}/${encodeURIComponent(viewbox)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
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
        console.error('[nominatim.proxy noboundedsearch] upstream error:', err?.message || err);
        const status = err.response?.status || 502;
        res.status(status).json(err.response?.data || { status, error: 'Upstream request failed' });
    }
});

// GET /nominatim/boundedsearch/:searchTerm/:limit/:viewbox
router.get('/boundedsearch/:searchTerm/:limit/:viewbox', [
    metric.count('nominatim.boundedsearch', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res) => {
    const { searchTerm, limit, viewbox } = req.params;
    try {
        const url = `/boundedsearch/${encodeURIComponent(searchTerm)}/${encodeURIComponent(limit)}/${encodeURIComponent(viewbox)}`;
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim'
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
        console.error('[nominatim.proxy boundedsearch] upstream error:', err?.message || err);
        const status = err.response?.status || 502;
        res.status(status).json(err.response?.data || { status, error: 'Upstream request failed' });
    }
});

module.exports = router;
