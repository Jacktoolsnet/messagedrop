const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const axios = require('axios');
const pollenCache = require('../db/tablePollenCache');

router.get('/:pluscode/:latitude/:longitude/:days', [security.checkToken], async (req, res) => {
    const db = req.database.db;
    const { pluscode, latitude, longitude, days } = req.params;
    let response = { status: 0 };

    try {
        const reducedPluscode = pluscode.substring(0, 8);  // ≈100m Genauigkeit
        const cacheKey = `${reducedPluscode}_${days}`;

        // Check cache
        pollenCache.getPollenData(db, cacheKey, async (err, row) => {
            if (err) {
                response.status = 500;
                response.error = err;
                return res.status(response.status).json(response);
            }

            if (row) {
                response.status = 200;
                response.data = JSON.parse(row.pollenData);
                return res.status(200).json(response);
            }

            // Query Open-Meteo Pollen API
            const openMeteoUrl = `https://api.open-meteo.com/v1/pollen?latitude=${latitude}&longitude=${longitude}&forecast_days=${days}&timezone=auto`;
            const apiResult = await axios.get(openMeteoUrl);

            response.status = 200;
            response.data = apiResult.data;

            // Save to cache
            pollenCache.setPollenData(db, cacheKey, JSON.stringify(apiResult.data), (err) => {
                if (err) { }
            });

            return res.status(200).json(response);
        });
    } catch (err) {
        console.error('Request error:', err);
        response.status = err.response?.status || 500;
        response.error = err.response?.data || 'Request failed';
        res.status(response.status).json(response);
    }
});

module.exports = router;