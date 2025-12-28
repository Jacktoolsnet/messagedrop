// routes/airQuality.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

// Ein eigenes Axios-Client mit BaseURL + Backend-Token
const client = axios.create({
    baseURL: `${process.env.OPENMETEO_BASE_URL}:${process.env.OPENMETEO_PORT}/airquality`,
    timeout: 5000,
    // wir wollen Fehlerstatus manuell durchreichen
    validateStatus: () => true,
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

// GET /airquality/:pluscode/:latitude/:longitude/:days  (alter Pfad beibehalten)
router.get('/:pluscode/:latitude/:longitude/:days', [
    metric.count('airquality', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
    const { pluscode, latitude, longitude, days } = req.params;

    try {
        // Wir proxien 1:1 an den neuen Service:
        const url = `/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}/${encodeURIComponent(days)}`;

        // Optional: Query/Headers aus der Original-Anfrage übernehmen (falls relevant)
        const token = await signServiceJwt({
            audience: process.env.SERVICE_JWT_AUDIENCE_OPENMETEO || 'service.openmeteo'
        });
        const upstream = await client.get(url, {
            params: req.query,
            // falls du zusätzliche Forward-Header brauchst:
            headers: {
                Authorization: `Bearer ${token}`,
                'x-forwarded-host': req.get('host'),
                'x-forwarded-proto': req.protocol,
            },
        });

        // Status & Body vom OpenMeteo-Service transparent weiterreichen
        // (dein Service liefert bereits { status, data, error } – wir geben es unverändert aus)
        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        // Netzwerk-/Timeout-/Axios-Fehler
        req.logger.error('[airQuality.proxy] upstream error:', err?.message || err);
        return next(buildUpstreamError(err));
    }
});

module.exports = router;
