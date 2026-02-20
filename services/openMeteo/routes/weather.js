const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const axios = require('axios');
const tableWeather = require('../db/tableWeather');
const tableWeatherHistory = require('../db/tableWeatherHistory');

router.use(security.checkToken);

const DEFAULT_UPSTREAM_TIMEOUT_MS = 10000;
const parsedUpstreamTimeoutMs = Number.parseInt(process.env.OPENMETEO_UPSTREAM_TIMEOUT_MS ?? '', 10);
const upstreamTimeoutMs = Number.isFinite(parsedUpstreamTimeoutMs) && parsedUpstreamTimeoutMs > 0
    ? parsedUpstreamTimeoutMs
    : DEFAULT_UPSTREAM_TIMEOUT_MS;

const forecastInFlight = new Map();
const historyInFlight = new Map();

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

router.get('/:locale/:pluscode/:latitude/:longitude/:days', async (req, res) => {
    const db = req.database.db;
    const { locale, pluscode, latitude, longitude, days } = req.params;
    const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
    const cacheKey = `${reducedPluscode}_${locale.toLowerCase().slice(0, 2)}_${days}`;
    const maxAgeMs = 60 * 60 * 1000; // 1 Stunde

    tableWeather.getWeatherData(db, cacheKey, async (err, row) => {
        if (err) {
            req.logger?.error('weather cache lookup failed', { cacheKey, error: err?.message });
        }

        const lastUpdate = row?.lastUpdate ? new Date(row.lastUpdate) : null;
        const isFresh = lastUpdate && Date.now() - lastUpdate.getTime() < maxAgeMs;

        if (row && isFresh) {
            return res.status(200).json({
                status: 200,
                data: JSON.parse(row.weatherData)
            });
        }

        try {
            const requestKey = `forecast:${cacheKey}`;
            const data = await withInFlight(forecastInFlight, requestKey, async () => {
                const url = 'https://api.open-meteo.com/v1/forecast';
                const params = {
                    latitude,
                    longitude,
                    current_weather: true,
                    hourly: 'temperature_2m,precipitation_probability,precipitation,uv_index,pressure_msl,windspeed_10m',
                    daily: 'sunrise,sunset,temperature_2m_max,temperature_2m_min',
                    forecast_days: days,
                    timezone: 'auto',
                    language: locale.toLowerCase().slice(0, 2)
                };
                const weatherRes = await axios.get(url, { params, timeout: upstreamTimeoutMs });
                const payload = weatherRes.data;
                const dataString = JSON.stringify(payload);
                tableWeather.setWeatherData(db, cacheKey, dataString, (cacheError) => {
                    if (cacheError) {
                        req.logger?.warn('weather cache update failed', { cacheKey, error: cacheError?.message });
                    }
                });
                return payload;
            });

            res.status(200).json({
                status: 200,
                data
            });
        } catch (err) {
            const status = err.response?.status || 500;
            const errorBody = err.response?.data || err.message || 'Request failed';
            req.logger?.error('weather fetch failed', { cacheKey, error: err?.message });
            res.status(status).json({
                status,
                error: errorBody
            });
        }
    });
});

router.get('/history/:pluscode/:latitude/:longitude/:years', async (req, res) => {
    let response = { status: 0 };
    const db = req.database.db;

    try {
        const { pluscode, latitude, longitude, years } = req.params;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - years);

        const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
        const cacheKey = `${reducedPluscode}_${years}`;

        const cachedData = await new Promise((resolve, reject) => {
            tableWeatherHistory.getHistoryData(db, cacheKey, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (cachedData) {
            response.status = 200;
            response.data = JSON.parse(cachedData.historyData);
            return res.status(200).json(response);
        }

        const requestKey = `history:${cacheKey}`;
        const historyData = await withInFlight(historyInFlight, requestKey, async () => {
            const url = 'https://archive-api.open-meteo.com/v1/archive';
            const params = {
                latitude,
                longitude,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                temperature_2m_mean: 'true',
                precipitation_sum: 'true',
                timezone: 'auto'
            };

            const weatherRes = await axios.get(url, { params, timeout: upstreamTimeoutMs });
            const payload = weatherRes.data;

            await new Promise((resolve, reject) => {
                tableWeatherHistory.setHistoryData(
                    db,
                    cacheKey,
                    JSON.stringify(payload),
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
            return payload;
        });

        response.status = 200;
        response.data = historyData;
        res.status(200).json(response);

    } catch (err) {
        response.status = err.response?.status || 500;
        response.error = err.response?.data || err.message || 'Request failed';
        res.status(response.status).json(response);
    }
});

module.exports = router;
