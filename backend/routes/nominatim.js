const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const { getCountryCodeFromNominatim } = require('../utils/nominatimQueue');
const tableNominatimCache = require('../db/tableNominatimCache');

router.get('/:pluscode/:latitude/:longitude', [security.checkToken], async (req, res) => {
    let response = { status: 0 };
    const { pluscode, latitude, longitude } = req.params;
    const db = req.database.db;

    try {
        // 1. Prüfen ob Cache vorhanden ist
        tableNominatimCache.getNominatimCache(db, pluscode, async (err, cachedRow) => {
            if (err) {
                response.status = 500;
                response.error = 'Database error';
                return res.status(500).json(response);
            }

            if (undefined != cachedRow) {
                response.status = 200;
                response.address = JSON.parse(cachedRow.address);
                return res.status(200).json(response);
            }

            // 2. Fallback: Request an Nominatim
            try {
                const nominatimData = await getCountryCodeFromNominatim(latitude, longitude);
                const address = nominatimData.address;
                response.status = 200;
                response.address = address;

                // 3. Ergebnis in Cache speichern
                tableNominatimCache.setNominatimCache(db, pluscode, JSON.stringify(address), (err) => { });

                return res.status(200).json(response);
            } catch (err) {
                response.status = 500;
                response.error = err;
                return res.status(response.status).json(response);
            }
        });
    } catch (error) {
        response.status = 500;
        response.error = JSON.stringify(error);
        return res.status(500).json(response);
    }
});

module.exports = router;