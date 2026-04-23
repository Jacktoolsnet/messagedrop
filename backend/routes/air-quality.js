// routes/airQuality.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const { resolveOpenMeteoProxyTimeoutMs } = require('../utils/openmeteo-timeout');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

// Ein eigenes Axios-Client mit BaseURL + Backend-Token
const openMeteoBase = resolveBaseUrl(process.env.OPENMETEO_BASE_URL, process.env.OPENMETEO_PORT);
const openMeteoProxyTimeoutMs = resolveOpenMeteoProxyTimeoutMs();
const client = axios.create({
    baseURL: `${openMeteoBase}/airquality`,
    timeout: openMeteoProxyTimeoutMs,
    // wir wollen Fehlerstatus manuell durchreichen
    validateStatus: () => true,
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
            headers: buildForwardHeaders(req, token),
        });

        // Status & Body vom OpenMeteo-Service transparent weiterreichen
        // (dein Service liefert bereits { status, data, error } – wir geben es unverändert aus)
        res.status(upstream.status).json(upstream.data);
    } catch (err) {
        // Netzwerk-/Timeout-/Axios-Fehler
        req.logger.error('[airQuality.proxy] upstream error', {
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
