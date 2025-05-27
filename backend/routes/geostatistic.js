const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const { getCountryCodeFromNominatim } = require('../utils/nominatimQueue');
const axios = require('axios');
const tableGeoStatistic = require('../db/tableGeoStatistic');
const tableWeatherHistory = require('../db/tableWeatherHistory');

// Helper: Fetch World Bank indicator, first valid value from last 10 years
async function getWorldBankIndicator(countryAlpha3, indicator) {
    const url = `https://api.worldbank.org/v2/country/${countryAlpha3}/indicator/${indicator}?format=json&per_page=10`;
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

        // Step 1: Get country code via Nominatim
        const nominatimData = await getCountryCodeFromNominatim(latitude, longitude);
        const countryAlpha2 = nominatimData.address.country_code.toUpperCase();

        // Step 2: Check GeoStatistic cache
        const cachedData = await new Promise((resolve, reject) => {
            tableGeoStatistic.getCountryData(db, countryAlpha2, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        let countryData, worldBankData;

        if (cachedData) {
            countryData = JSON.parse(cachedData.countryData);
            worldBankData = JSON.parse(cachedData.worldbankData);
        } else {
            // Fetch RestCountries data
            const restCountriesRes = await axios.get(`https://restcountries.com/v3.1/alpha/${countryAlpha2}`);
            countryData = restCountriesRes.data[0];

            const countryAlpha3 = countryData.cca3;
            if (!countryAlpha3) {
                throw new Error('Alpha-3 country code not found for World Bank API');
            }

            // Fetch World Bank data with fallback search over 10 years
            const gdp = await getWorldBankIndicator(countryAlpha3, 'NY.GDP.MKTP.CD');
            const gniPerCapita = await getWorldBankIndicator(countryAlpha3, 'NY.GNP.PCAP.CD');
            const lifeExpectancy = await getWorldBankIndicator(countryAlpha3, 'SP.DYN.LE00.IN');
            const povertyRate = await getWorldBankIndicator(countryAlpha3, 'SI.POV.DDAY');

            worldBankData = { gdp, gniPerCapita, lifeExpectancy, povertyRate };

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

        // Step 3: Calculate derived metrics
        const population = countryData.population;
        const area = countryData.area;
        const populationDensity = population && area ? population / area : null;
        const gdpPerCapita = worldBankData.gdp.value && population ? worldBankData.gdp.value / population : null;

        // Step 4: Get Weather History from cache or fetch if missing
        const weatherYears = 10;
        const weatherCacheKey = `${latitude}_${longitude}_${weatherYears}`;
        let weatherHistoryData = await new Promise((resolve, reject) => {
            tableWeatherHistory.getHistoryData(db, weatherCacheKey, (err, row) => {
                if (err) return reject(err);
                resolve(row ? JSON.parse(row.historyData) : null);
            });
        });

        if (!weatherHistoryData) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(endDate.getFullYear() - weatherYears);

            const weatherUrl = 'https://archive-api.open-meteo.com/v1/archive';
            const weatherParams = {
                latitude,
                longitude,
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0],
                temperature_2m_mean: 'true',
                precipitation_sum: 'true',
                timezone: 'auto'
            };

            const weatherRes = await axios.get(weatherUrl, { params: weatherParams });
            weatherHistoryData = weatherRes.data;

            await new Promise((resolve, reject) => {
                tableWeatherHistory.setHistoryData(
                    db,
                    weatherCacheKey,
                    JSON.stringify(weatherHistoryData),
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        }

        // Step 5: Build final response
        response.status = 200;
        response.result = {
            coordinates: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
            nominatim: {
                country: nominatimData.address.country,
                state: nominatimData.address.state,
                county: nominatimData.address.county,
                city: nominatimData.address.city || nominatimData.address.town || nominatimData.address.village,
                suburb: nominatimData.address.suburb,
                neighbourhood: nominatimData.address.neighbourhood
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
            },
            weatherHistory: weatherHistoryData
        };

        res.status(200).json(response);

    } catch (err) {
        response.status = err.response?.status || 500;
        response.error = err.response?.data || err.message || 'Request failed';
        res.status(response.status).json(response);
    }
});

module.exports = router;