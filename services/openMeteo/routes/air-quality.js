const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const axios = require('axios');
const airQualityCache = require('../db/tableAirQuality');

router.use(security.checkToken);

const DEFAULT_UPSTREAM_TIMEOUT_MS = 10000;
const parsedUpstreamTimeoutMs = Number.parseInt(process.env.OPENMETEO_UPSTREAM_TIMEOUT_MS ?? '', 10);
const upstreamTimeoutMs = Number.isFinite(parsedUpstreamTimeoutMs) && parsedUpstreamTimeoutMs > 0
    ? parsedUpstreamTimeoutMs
    : DEFAULT_UPSTREAM_TIMEOUT_MS;

const airQualityInFlight = new Map();

function withInFlight(map, key, factory) {
    const existing = map.get(key);
    if (existing) {
        return existing;
    }
    const promise = Promise.resolve()
        .then(factory)
        .finally(() => {
            map.delete(key);
        });
    map.set(key, promise);
    return promise;
}

router.get('/:pluscode/:latitude/:longitude/:days', async (req, res) => {
    const db = req.database.db;
    const { pluscode, latitude, longitude, days } = req.params;
    const response = { status: 0 };

    try {
        const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
        const cacheKey = `${reducedPluscode}_${days}`;

        airQualityCache.getAirQualityData(db, cacheKey, async (err, row) => {
            if (err) {
                response.status = 500;
                response.error = err;
                return res.status(response.status).json(response);
            }

            if (row) {
                response.status = 200;
                response.data = JSON.parse(row.airQualityData);
                return res.status(200).json(response);
            }

            const hourlyParams = [
                'alder_pollen',
                'birch_pollen',
                'grass_pollen',
                'mugwort_pollen',
                'olive_pollen',
                'ragweed_pollen',
                'pm10',
                'pm2_5',
                'carbon_monoxide',
                'nitrogen_dioxide',
                'sulphur_dioxide',
                'ozone'
            ].join(',');

            const openMeteoUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&forecast_days=${days}&hourly=${hourlyParams}&timezone=auto`;

            try {
                const requestKey = `airquality:${cacheKey}`;
                const data = await withInFlight(airQualityInFlight, requestKey, async () => {
                    const apiResult = await axios.get(openMeteoUrl, { timeout: upstreamTimeoutMs });
                    if (!apiResult.data || Object.keys(apiResult.data).length === 0) {
                        return null;
                    }

                    airQualityCache.setAirQualityData(db, cacheKey, JSON.stringify(apiResult.data), (err) => {
                        if (err) {
                            req.logger?.warn?.('Air quality cache write failed', { cacheKey, error: err?.message || err });
                        }
                    });

                    return apiResult.data;
                });

                if (!data || Object.keys(data).length === 0) {
                    response.status = 204; // No content
                    response.error = 'Empty data from Open-Meteo';
                    return res.status(response.status).json(response);
                }

                response.status = 200;
                response.data = data;

                return res.status(200).json(response);
            } catch (apiErr) {
                req.logger?.error?.('Air quality upstream error', { error: apiErr?.message || apiErr });
                if (apiErr.response?.status === 404) {
                    response.status = 204; // No content
                    response.error = 'No air quality data available for this location';
                } else {
                    response.status = apiErr.response?.status || 500;
                    response.error = apiErr.response?.data || 'Request to Open-Meteo failed';
                }
                return res.status(response.status).json(response);
            }
        });
    } catch (err) {
        req.logger?.error?.('Air quality request error', { error: err?.message || err });
        response.status = 500;
        response.error = 'Internal server error';
        return res.status(response.status).json(response);
    }
});

module.exports = router;
