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

function getCachedWeatherRow(db, cacheKey) {
    return new Promise((resolve, reject) => {
        tableWeather.getWeatherData(db, cacheKey, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

function setCachedWeatherRow(db, cacheKey, weatherData, logger) {
    return new Promise((resolve) => {
        tableWeather.setWeatherData(db, cacheKey, weatherData, (cacheError) => {
            if (cacheError) {
                logger?.warn('weather cache update failed', { cacheKey, error: cacheError?.message });
            }
            resolve();
        });
    });
}

function getCachedHistoryRow(db, cacheKey) {
    return new Promise((resolve, reject) => {
        tableWeatherHistory.getHistoryData(db, cacheKey, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(row);
        });
    });
}

function setCachedHistoryRow(db, cacheKey, historyData, logger) {
    return new Promise((resolve) => {
        tableWeatherHistory.setHistoryData(db, cacheKey, historyData, (err) => {
            if (err) {
                logger?.warn('weather history cache update failed', { cacheKey, error: err?.message });
            }
            resolve();
        });
    });
}

function parseCachedJson(value, logger, message, context) {
    try {
        return JSON.parse(value);
    } catch (err) {
        logger?.warn(message, { ...context, error: err?.message });
        return null;
    }
}

function isTimeoutError(err) {
    return err?.code === 'ECONNABORTED'
        || String(err?.message || '').toLowerCase().includes('timeout');
}

function resolveUpstreamStatus(err, fallbackStatus = 500) {
    if (Number.isFinite(err?.response?.status)) {
        return err.response.status;
    }
    return isTimeoutError(err) ? 504 : fallbackStatus;
}

function buildStaleWeatherResponse(row, cacheKey, logger) {
    if (!row?.weatherData) {
        return null;
    }
    const data = parseCachedJson(row.weatherData, logger, 'weather stale cache parse failed', { cacheKey });
    if (data === null) {
        return null;
    }
    const lastUpdate = row?.lastUpdate ? new Date(row.lastUpdate) : null;
    const staleAgeMs = lastUpdate ? Date.now() - lastUpdate.getTime() : null;
    return {
        status: 200,
        data,
        stale: true,
        staleAgeMs: Number.isFinite(staleAgeMs) ? staleAgeMs : undefined
    };
}

router.get('/:locale/:pluscode/:latitude/:longitude/:days', async (req, res) => {
    const db = req.database?.db ?? null;
    const { locale, pluscode, latitude, longitude, days } = req.params;
    const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
    const cacheKey = `${reducedPluscode}_${locale.toLowerCase().slice(0, 2)}_${days}`;
    const maxAgeMs = 60 * 60 * 1000; // 1 Stunde
    let row = null;

    if (db) {
        try {
            row = await getCachedWeatherRow(db, cacheKey);
        } catch (err) {
            req.logger?.error('weather cache lookup failed', { cacheKey, error: err?.message });
        }
    } else {
        req.logger?.warn?.('weather cache unavailable', { cacheKey, reason: 'database_unavailable' });
    }

    const lastUpdate = row?.lastUpdate ? new Date(row.lastUpdate) : null;
    const isFresh = lastUpdate && Date.now() - lastUpdate.getTime() < maxAgeMs;

    if (row && isFresh) {
        const cachedData = parseCachedJson(row.weatherData, req.logger, 'weather cache parse failed', { cacheKey });
        if (cachedData !== null) {
            return res.status(200).json({
                status: 200,
                data: cachedData
            });
        }
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
            if (db) {
                await setCachedWeatherRow(db, cacheKey, dataString, req.logger);
            }
            return payload;
        });

        return res.status(200).json({
            status: 200,
            data
        });
    } catch (err) {
        const staleResponse = row ? buildStaleWeatherResponse(row, cacheKey, req.logger) : null;
        if (staleResponse && (isTimeoutError(err) || resolveUpstreamStatus(err, 500) >= 500)) {
            req.logger?.warn('weather stale cache fallback used', {
                cacheKey,
                error: err?.message,
                timeout: isTimeoutError(err),
                staleAgeMs: staleResponse.staleAgeMs
            });
            return res.status(200).json(staleResponse);
        }

        const status = resolveUpstreamStatus(err, 500);
        const errorBody = err.response?.data || err.message || 'Request failed';
        req.logger?.error('weather fetch failed', {
            cacheKey,
            error: err?.message,
            timeout: isTimeoutError(err),
            status
        });
        return res.status(status).json({
            status,
            error: errorBody
        });
    }
});

router.get('/history/:pluscode/:latitude/:longitude/:years', async (req, res) => {
    const response = { status: 0 };
    const db = req.database?.db ?? null;

    try {
        const { pluscode, latitude, longitude, years } = req.params;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - years);

        const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
        const cacheKey = `${reducedPluscode}_${years}`;

        let cachedData = null;
        if (db) {
            try {
                cachedData = await getCachedHistoryRow(db, cacheKey);
            } catch (err) {
                req.logger?.error('weather history cache lookup failed', { cacheKey, error: err?.message });
            }
        } else {
            req.logger?.warn?.('weather history cache unavailable', { cacheKey, reason: 'database_unavailable' });
        }

        if (cachedData) {
            const parsedHistory = parseCachedJson(
                cachedData.historyData,
                req.logger,
                'weather history cache parse failed',
                { cacheKey }
            );
            if (parsedHistory !== null) {
                response.status = 200;
                response.data = parsedHistory;
                return res.status(200).json(response);
            }
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

            if (db) {
                await setCachedHistoryRow(db, cacheKey, JSON.stringify(payload), req.logger);
            }
            return payload;
        });

        response.status = 200;
        response.data = historyData;
        return res.status(200).json(response);

    } catch (err) {
        response.status = resolveUpstreamStatus(err, 500);
        response.error = err.response?.data || err.message || 'Request failed';
        return res.status(response.status).json(response);
    }
});

module.exports = router;
