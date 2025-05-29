const CACHE_TTL_DAYS = 30;
const express = require('express');
const router = express.Router();
const axios = require('axios');
const security = require('../middleware/security');
const { getCountryCodeFromNominatim } = require('../utils/nominatimQueue');
const tableGeoStatistic = require('../db/tableGeoStatistic');
const tableWeatherHistory = require('../db/tableWeatherHistory');

// Helper function for World Bank API
async function getWorldBankIndicator(countryAlpha3, indicator, years) {
    const url = `http://api.worldbank.org/v2/country/${countryAlpha3}/indicator/${indicator}?format=json&per_page=${years}`;
    const response = await axios.get(url);
    const dataArray = response.data[1];
    if (!Array.isArray(dataArray)) return [];

    return dataArray
        .filter(entry => entry.value !== null)
        .map(entry => ({
            year: entry.date,
            value: entry.value
        }));
}

router.get('/:latitude/:longitude/:years', [security.checkToken], async (req, res) => {
    let response = { status: 0 };
    const db = req.database.db;

    try {
        const { latitude, longitude, years } = req.params;
        const yearCount = parseInt(years, 10) || 10;

        // Step 1: Get country code (Alpha-2) from Nominatim
        const nominatimData = await getCountryCodeFromNominatim(latitude, longitude);
        const address = nominatimData.address;
        const countryAlpha2 = address?.country_code?.toUpperCase();
        if (!countryAlpha2) throw new Error('Country code not found');

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
            if (!countryAlpha3) throw new Error('Alpha-3 country code not found for World Bank API');

            // World Bank indicators (get arrays of last N years)
            const gdp = await getWorldBankIndicator(countryAlpha3, 'NY.GDP.MKTP.CD', yearCount);
            const gniPerCapita = await getWorldBankIndicator(countryAlpha3, 'NY.GNP.PCAP.CD', yearCount);
            const militaryExpenditure = await getWorldBankIndicator(countryAlpha3, 'MS.MIL.XPND.GD.ZS', yearCount);
            const governmentSpending = await getWorldBankIndicator(countryAlpha3, 'GC.XPN.TOTL.GD.ZS', yearCount);
            const inflation = await getWorldBankIndicator(countryAlpha3, 'FP.CPI.TOTL.ZG', yearCount);
            const unemployment = await getWorldBankIndicator(countryAlpha3, 'SL.UEM.TOTL.ZS', yearCount);
            const investment = await getWorldBankIndicator(countryAlpha3, 'NE.GDI.TOTL.ZS', yearCount);
            const lifeExpectancy = await getWorldBankIndicator(countryAlpha3, 'SP.DYN.LE00.IN', yearCount);
            const povertyRate = await getWorldBankIndicator(countryAlpha3, 'SI.POV.DDAY', yearCount);
            const literacyRate = await getWorldBankIndicator(countryAlpha3, 'SE.ADT.LITR.ZS', yearCount);
            const primaryEnrollment = await getWorldBankIndicator(countryAlpha3, 'SE.PRM.ENRR', yearCount);
            const secondaryEnrollment = await getWorldBankIndicator(countryAlpha3, 'SE.SEC.ENRR', yearCount);
            const giniIndex = await getWorldBankIndicator(countryAlpha3, 'SI.POV.GINI', yearCount);
            const co2Emissions = await getWorldBankIndicator(countryAlpha3, 'EN.ATM.CO2E.PC', yearCount);
            const renewableEnergy = await getWorldBankIndicator(countryAlpha3, 'EG.FEC.RNEW.ZS', yearCount);
            const forestArea = await getWorldBankIndicator(countryAlpha3, 'AG.LND.FRST.ZS', yearCount);
            const airPollution = await getWorldBankIndicator(countryAlpha3, 'EN.ATM.PM25.MC.M3', yearCount);
            const energyUse = await getWorldBankIndicator(countryAlpha3, 'EG.USE.PCAP.KG.OE', yearCount);

            worldBankData = {
                gdp,
                gniPerCapita,
                militaryExpenditure,
                governmentSpending,
                inflation,
                unemployment,
                investment,
                lifeExpectancy,
                povertyRate,
                literacyRate,
                primaryEnrollment,
                secondaryEnrollment,
                giniIndex,
                co2Emissions,
                renewableEnergy,
                forestArea,
                airPollution,
                energyUse
            };

            // Save to cache
            await new Promise((resolve, reject) => {
                tableGeoStatistic.setCountryData(
                    db,
                    countryAlpha2,
                    JSON.stringify(countryData),
                    JSON.stringify(worldBankData),
                    (err) => (err ? reject(err) : resolve())
                );
            });
        }

        // Step 4: Get Weather History (from cache or fresh)
        const cacheKey = `${latitude}_${longitude}_${yearCount}`;
        let weatherHistoryData = await new Promise((resolve, reject) => {
            tableWeatherHistory.getHistoryData(db, cacheKey, (err, row) => {
                if (err) return reject(err);
                resolve(row ? JSON.parse(row.historyData) : null);
            });
        });

        if (!weatherHistoryData) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(endDate.getFullYear() - yearCount);
            const weatherRes = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
                params: {
                    latitude,
                    longitude,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    temperature_2m_mean: 'true',
                    precipitation_sum: 'true',
                    timezone: 'auto'
                }
            });
            weatherHistoryData = weatherRes.data;
            await new Promise((resolve, reject) => {
                tableWeatherHistory.setHistoryData(
                    db,
                    cacheKey,
                    JSON.stringify(weatherHistoryData),
                    (err) => (err ? reject(err) : resolve())
                );
            });
        }

        // Step 5: Build final response
        const population = countryData.population;
        const area = countryData.area;
        const populationDensity = population && area ? population / area : null;

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
            worldBank: worldBankData,
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