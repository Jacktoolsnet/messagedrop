const CACHE_TTL_DAYS = 30;

const express = require('express');
const router = express.Router();
const axios = require('axios');
const security = require('../middleware/security');
const { getCountryCodeFromNominatim } = require('../utils/nominatimQueue');
const tableGeoStatistic = require('../db/tableGeoStatistic');

// Helper function for World Bank API
async function getWorldBankIndicator(countryAlpha3, indicator) {
    const url = `http://api.worldbank.org/v2/country/${countryAlpha3}/indicator/${indicator}?format=json&per_page=10`;
    const response = await axios.get(url);
    const dataArray = response.data[1];

    if (!Array.isArray(dataArray)) {
        return { year: null, value: null };
    }

    const validEntry = dataArray.find(entry => entry.value !== null);
    return {
        year: validEntry?.date || null,
        value: validEntry?.value || null
    };
}

router.get('/:latitude/:longitude', [security.checkToken], async (req, res) => {
    let response = { status: 0 };
    const db = req.database.db;

    try {
        const { latitude, longitude } = req.params;

        // Step 1: Get country code from Nominatim (Alpha-2)
        const nominatimData = await getCountryCodeFromNominatim(latitude, longitude);
        const address = nominatimData.address;
        const countryAlpha2 = address?.country_code?.toUpperCase();

        if (!countryAlpha2) {
            throw new Error('Country code not found');
        }

        // Step 2: Check SQLite cache
        const cachedData = await new Promise((resolve, reject) => {
            tableGeoStatistic.getCountryData(db, countryAlpha2, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        let countryData, worldBankData;

        if (cachedData) {
            const lastUpdate = new Date(cachedData.lastUpdate);
            const expiryDate = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

            if (lastUpdate >= expiryDate) {
                countryData = JSON.parse(cachedData.countryData);
                worldBankData = JSON.parse(cachedData.worldbankData);
            }
        }

        // Step 3: If no valid cache, fetch fresh data
        if (!countryData || !worldBankData) {
            const restCountriesResponse = await axios.get(`https://restcountries.com/v3.1/alpha/${countryAlpha2}`);
            countryData = restCountriesResponse.data[0];

            const countryAlpha3 = countryData.cca3;
            if (!countryAlpha3) {
                throw new Error('Alpha-3 country code not found for World Bank API');
            }

            const gdp = await getWorldBankIndicator(countryAlpha3, 'NY.GDP.MKTP.CD');
            const gniPerCapita = await getWorldBankIndicator(countryAlpha3, 'NY.GNP.PCAP.CD');
            const lifeExpectancy = await getWorldBankIndicator(countryAlpha3, 'SP.DYN.LE00.IN');
            const povertyRate = await getWorldBankIndicator(countryAlpha3, 'SI.POV.DDAY');

            worldBankData = { gdp, gniPerCapita, lifeExpectancy, povertyRate };

            // Save new data to cache
            await new Promise((resolve, reject) => {
                tableGeoStatistic.setCountryData(
                    db,
                    countryAlpha2,
                    JSON.stringify(countryData),
                    JSON.stringify(worldBankData),
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        }

        // Step 4: Calculate derived metrics
        const population = countryData.population;
        const area = countryData.area;
        const populationDensity = population && area ? population / area : null;
        const gdpPerCapita = worldBankData.gdp.value && population ? worldBankData.gdp.value / population : null;

        // Step 5: Build final response
        response.status = 200;
        response.result = {
            coordinates: { latitude, longitude },
            nominatim: {
                country: address.country,
                state: address.state,
                county: address.county,
                city: address.city || address.town || address.village,
                suburb: address.suburb,
                neighbourhood: address.neighbourhood
            },
            countryInfo: {
                name: countryData.name.common,
                officialName: countryData.name.official,
                capital: countryData.capital?.[0],
                region: countryData.region,
                subregion: countryData.subregion,
                population,
                area_km2: area,
                populationDensity_per_km2: populationDensity,
                currencies: Object.values(countryData.currencies).map(c => `${c.name} (${c.symbol})`),
                languages: Object.values(countryData.languages),
                flag_svg: countryData.flags.svg,
                googleMaps: countryData.maps.googleMaps
            },
            worldBank: {
                gdp: worldBankData.gdp,
                gdpPerCapita,
                gniPerCapita: worldBankData.gniPerCapita,
                lifeExpectancy: worldBankData.lifeExpectancy,
                povertyRate: worldBankData.povertyRate
            }
        };

        res.status(200).json(response);

    } catch (err) {
        response.status = err.response?.status || 500;
        response.error = err.response?.data || err.message || 'Request failed';
        res.status(response.status).json(response);
    }
});

module.exports = router;