const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const { getCountryCodeFromNominatim } = require('../utils/nominatimQueue');

router.get('/:latitude/:longitude', [security.checkToken], async (req, res) => {
    let response = { status: 0 };
    try {
        const { latitude, longitude } = req.params;

        const nominatimData = await getCountryCodeFromNominatim(latitude, longitude);

        response.status = 200;
        response.address = nominatimData.address;
        res.status(200).json(response);
    } catch (err) {
        response.status = err.response?.status || 500;
        response.error = err.response?.data || 'Request failed';
        res.status(response.status).json(response);
    }
});

module.exports = router;