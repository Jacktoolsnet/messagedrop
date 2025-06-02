const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const axios = require('axios');
const airQualityCache = require('../db/tableAirQuality');

router.get('/:pluscode/:latitude/:longitude/:days', [security.checkToken], async (req, res) => {
    const db = req.database.db;
    const { pluscode, latitude, longitude, days } = req.params;
    const response = { status: 0 };

    try {
        const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
        const cacheKey = `${reducedPluscode}_${days}`;

        airQualityCache.getAirQualityData(db, cacheKey, async (err, row) => {
            if (err) {
                console.error('DB read error:', err);
                response.status = 500;
                response.error = 'Database read error';
                return res.status(response.status).json(response);
            }

            if (row) {
                console.log('Serving air quality data from cache');
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
            console.log('Fetching air quality data from Open-Meteo:', openMeteoUrl);

            try {
                const apiResult = await axios.get(openMeteoUrl);
                if (!apiResult.data || Object.keys(apiResult.data).length === 0) {
                    response.status = 204; // No content
                    response.error = 'Empty data from Open-Meteo';
                    return res.status(response.status).json(response);
                }

                response.status = 200;
                response.data = apiResult.data;

                airQualityCache.setAirQualityData(db, cacheKey, JSON.stringify(apiResult.data), (err) => {
                    if (err) {
                        console.warn('Cache write failed:', err);
                    }
                });

                return res.status(200).json(response);
            } catch (apiErr) {
                console.error('Axios error:', apiErr);
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
        console.error('Request error:', err);
        response.status = 500;
        response.error = 'Internal server error';
        return res.status(response.status).json(response);
    }
});

module.exports = router;