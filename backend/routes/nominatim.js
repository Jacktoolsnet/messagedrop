const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const { getCountryCodeFromNominatim, getPlaceFromNominatimText } = require('../utils/nominatimQueue');
const tableNominatimCache = require('../db/tableNominatimCache.js');
const tableGeoSearch = require('../db/tableGeoSearch')
const metric = require('../middleware/metric');

router.use(security.checkToken);

router.get('/countryCode/:pluscode/:latitude/:longitude',
    [
        metric.count('nominatim.countrycode', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
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
                    response.nominatimPlace = JSON.parse(cachedRow.nominatimPlace);
                    return res.status(200).json(response);
                }

                // 2. Fallback: Request an Nominatim
                try {
                    const nominatimPlace = await getCountryCodeFromNominatim(latitude, longitude);
                    response.status = 200;
                    response.nominatimPlace = nominatimPlace;

                    // 3. Ergebnis in Cache speichern
                    tableNominatimCache.setNominatimCache(db, pluscode, JSON.stringify(nominatimPlace), (err) => { });

                    return res.status(200).json(response);
                } catch (err) {
                    response.status = 500;
                    response.error = err;
                    return res.status(response.status).json(response);
                }
            });
        } catch (error) {
            response.status = 500;
            response.error = error;
            return res.status(500).json(response);
        }
    });

router.get('/search/:searchTerm/:limit',
    [
        metric.count('nominatim.search', { when: 'always', timezone: 'utc', amount: 1 })
    ], async (req, res) => {
        let response = { status: 0 };
        const { searchTerm, limit } = req.params;
        const db = req.database.db;

        try {
            // 1. Prüfen, ob der Begriff bereits gecacht wurde
            tableGeoSearch.getGeoSearchResult(db, searchTerm, async (err, cachedRow) => {
                if (err) {
                    response.status = 500;
                    response.error = 'Database error';
                    return res.status(500).json(response);
                }

                if (cachedRow) {
                    response.status = 200;
                    response.result = JSON.parse(cachedRow);
                    return res.status(200).json(response);
                }

                try {
                    // 2. Anfrage an Nominatim
                    const result = await getPlaceFromNominatimText(searchTerm, limit);

                    if (!result || !Array.isArray(result) || result.length === 0) {
                        response.status = 404;
                        response.error = 'No results found';
                        return res.status(404).json(response);
                    }

                    // 3. In den Cache schreiben
                    tableGeoSearch.setGeoSearchResult(db, searchTerm, JSON.stringify(result), () => { });

                    response.status = 200;
                    response.result = result;
                    return res.status(200).json(response);

                } catch (err) {
                    response.status = 500;
                    response.error = err.message || err;
                    return res.status(500).json(response);
                }
            });
        } catch (error) {
            response.status = 500;
            response.error = error;
            return res.status(500).json(response);
        }
    });

router.get('/noboundedsearch/:searchTerm/:limit/:viewbox',
    [
        metric.count('nominatim.noboundedsearch', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        let response = { status: 0 };
        const { searchTerm, limit, viewbox } = req.params;
        const db = req.database.db;
        const cacheKey = `${searchTerm}_${viewbox}_nobounded`

        try {
            // 1. Prüfen, ob bereits gecacht
            tableGeoSearch.getGeoSearchResult(db, cacheKey, async (err, cachedRow) => {
                if (err) {
                    response.status = 500;
                    response.error = 'Database error';
                    return res.status(500).json(response);
                }
                if (cachedRow) {
                    response.status = 200;
                    response.result = JSON.parse(cachedRow);
                    return res.status(200).json(response);
                }

                try {
                    // 2. Viewbox optional verwenden
                    const options = { viewbox };

                    const result = await getPlaceFromNominatimText(searchTerm, limit, options);

                    if (!result || !Array.isArray(result) || result.length === 0) {
                        response.status = 404;
                        response.error = 'No results found';
                        return res.status(404).json(response);
                    }

                    // 3. Cache schreiben
                    tableGeoSearch.setGeoSearchResult(db, cacheKey, JSON.stringify(result), () => { });
                    response.status = 200;
                    response.result = result;
                    return res.status(200).json(response);

                } catch (err) {
                    response.status = 500;
                    response.error = err.message || err;
                    return res.status(500).json(response);
                }
            });
        } catch (error) {
            response.status = 500;
            response.error = error;
            return res.status(500).json(response);
        }
    });

router.get('/boundedsearch/:searchTerm/:limit/:viewbox',
    [
        metric.count('nominatim.boundedsearch', { when: 'always', timezone: 'utc', amount: 1 })
    ]
    , async (req, res) => {
        let response = { status: 0 };
        const { searchTerm, limit, viewbox } = req.params;
        const db = req.database.db;
        const cacheKey = `${searchTerm}_${viewbox}_bounded`

        try {
            // 1. Prüfen, ob bereits gecacht
            tableGeoSearch.getGeoSearchResult(db, cacheKey, async (err, cachedRow) => {
                if (err) {
                    response.status = 500;
                    response.error = 'Database error';
                    return res.status(500).json(response);
                }
                if (cachedRow) {
                    response.status = 200;
                    response.result = JSON.parse(cachedRow);
                    return res.status(200).json(response);
                }

                try {
                    // 2. Viewbox optional verwenden
                    const options = { viewbox, bounded: 1 };

                    const result = await getPlaceFromNominatimText(searchTerm, limit, options);

                    if (!result || !Array.isArray(result) || result.length === 0) {
                        response.status = 404;
                        response.error = 'No results found';
                        return res.status(404).json(response);
                    }

                    // 3. Cache schreiben
                    tableGeoSearch.setGeoSearchResult(db, cacheKey, JSON.stringify(result), () => { });
                    response.status = 200;
                    response.result = result;
                    return res.status(200).json(response);

                } catch (err) {
                    response.status = 500;
                    response.error = err.message || err;
                    return res.status(500).json(response);
                }
            });
        } catch (error) {
            response.status = 500;
            response.error = error;
            return res.status(500).json(response);
        }
    });

module.exports = router;