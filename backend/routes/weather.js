const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const axios = require('axios');

router.get('/:locale/:latitude/:longitude/:days', [security.checkToken], async (req, res) => {
    let response = { status: 0 };
    try {
        const { locale, latitude, longitude, days } = req.params;

        const url = 'https://api.open-meteo.com/v1/forecast';
        const params = {
            latitude,
            longitude,
            current_weather: true,
            hourly: 'temperature_2m,precipitation_probability,uv_index',
            daily: 'sunrise,sunset,temperature_2m_max,temperature_2m_min',
            forecast_days: days,
            timezone: 'auto',
            language: locale.toLowerCase().slice(0, 2)
        };
        const weatherRes = await axios.get(url, { params });
        response.status = 200;
        response.data = weatherRes.data;
        res.status(200).json(response);
    } catch (err) {
        response.status = err.response?.status || 500;
        response.error = err.response?.data || 'Request failed';
        res.status(response.status).json(response);
    }
});

module.exports = router;