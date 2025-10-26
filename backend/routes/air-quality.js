// routes/airQuality.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const metric = require('../middleware/metric');
const security = require('../middleware/security');

// Ein eigenes Axios-Client mit BaseURL + Backend-Token
const client = axios.create({
    baseURL: `${process.env.OPENMETEO_BASE_URL}:${process.env.OPENMETEO_PORT}/airquality`,
    timeout: 5000,
    // wir wollen Fehlerstatus manuell durchreichen
    validateStatus: () => true,
    headers: {
        'content-type': 'application/json',
        'x-api-authorization': process.env.BACKEND_TOKEN
    }
});

// Eingehende Requests weiterhin per App-Token absichern
router.use(security.checkToken);

// GET /airquality/:pluscode/:latitude/:longitude/:days  (alter Pfad beibehalten)
router.get('/:pluscode/:latitude/:longitude/:days', [
    metric.count('airquality', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res) => {
    const { pluscode, latitude, longitude, days } = req.params;

    try {
        // Wir proxien 1:1 an den neuen Service:
        const url = `/${encodeURIComponent(pluscode)}/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}/${encodeURIComponent(days)}`;

        // Optional: Query/Headers aus der Original-Anfrage übernehmen (falls relevant)
        const upstream = await client.get(url, {
            params: req.query,
            // falls du zusätzliche Forward-Header brauchst:
            headers: {
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
        const isAxios = !!err?.isAxiosError;
        const status = isAxios ? (err.response?.status || 502) : 500;
        const payload = isAxios
            ? (err.response?.data || { status, error: 'Upstream request failed' })
            : { status, error: 'Internal server error' };
        res.status(status).json(payload);
    }
});

module.exports = router;