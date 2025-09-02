const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const axios = require('axios');
const tableWeather = require('../db/tableWeather');
const metric = require('../middleware/metric');

router.get('/:locale/:pluscode/:latitude/:longitude/:days',
    [
        security.checkToken,
        metric.count('weather', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        const db = req.database.db;
        const { locale, pluscode, latitude, longitude, days } = req.params;
        const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
        const cacheKey = `${reducedPluscode}_${locale.toLowerCase().slice(0, 2)}`;
        const maxAgeMs = 60 * 60 * 1000; // 1 Stunde

        tableWeather.getWeatherData(db, cacheKey, async (err, row) => {
            if (err) { }

            const lastUpdate = row?.lastUpdate ? new Date(row.lastUpdate) : null;
            const isFresh = lastUpdate && Date.now() - lastUpdate.getTime() < maxAgeMs;

            if (row && isFresh) {
                return res.status(200).json({
                    status: 200,
                    data: JSON.parse(row.weatherData)
                });
            }

            try {
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
                const weatherRes = await axios.get(url, { params });

                const dataString = JSON.stringify(weatherRes.data);
                tableWeather.setWeatherData(db, cacheKey, dataString, (err) => { });

                res.status(200).json({
                    status: 200,
                    data: weatherRes.data
                });
            } catch (err) {
                const status = 500;
                res.status(status).json({
                    status,
                    error: err
                });
            }
        });
    });

router.get('/history/:pluscode/:latitude/:longitude/:years',
    [
        security.checkToken,
        metric.count('weather.history', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
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

            const weatherRes = await axios.get(url, { params });
            const historyData = weatherRes.data;

            await new Promise((resolve, reject) => {
                tableWeatherHistory.setHistoryData(
                    db,
                    cacheKey,
                    JSON.stringify(historyData),
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
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