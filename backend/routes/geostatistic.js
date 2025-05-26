const CACHE_TTL_DAYS = 30;

const express = require('express');
const router = express.Router();
const axios = require('axios');
const security = require('../middleware/security');
const { getCountryCodeFromNominatim } = require('../utils/nominatimQueue');
const tableGeoStatistic = require('../db/tableGeoStatistic');

async function getWorldBankIndicator(countryCode, indicator) {
    const url = `http://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&per_page=1`;
    const response = await axios.get(url);
    const data = response.data[1]?.[0];
    return {
        year: data?.date,
        value: data?.value
    };
}

router.get('/:latitude/:longitude', [security.checkToken], async (req, res) => {
    let response = { status: 0 };
    const db = req.database.db;

    try {
        const { latitude, longitude } = req.params;

        // 1. Hole Nominatim
        const nominatimData = await getCountryCodeFromNominatim(latitude, longitude);
        const address = nominatimData.address;
        const countryCode = address?.country_code?.toUpperCase();

        if (!countryCode) {
            throw new Error('Country code not found');
        }

        // 2. Prüfe Cache
        const cachedData = await new Promise((resolve, reject) => {
            tableGeoStatistic.getCountryData(db, countryCode, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        let countryData, worldBankData;

        if (cachedData) {
            const lastUpdate = new Date(cachedData.lastUpdate);
            const expiryDate = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

            if (lastUpdate >= expiryDate) {
                // Cache gültig → verwende gespeicherte Daten
                countryData = JSON.parse(cachedData.countryData);
                worldBankData = JSON.parse(cachedData.worldbankData);
            }
        }

        // 3. Wenn kein gültiger Cache → APIs abfragen
        if (!countryData || !worldBankData) {
            const restCountriesResponse = await axios.get(`https://restcountries.com/v3.1/alpha/${countryCode}`);
            countryData = restCountriesResponse.data[0];

            const gdp = await getWorldBankIndicator(countryCode, 'NY.GDP.MKTP.CD');
            const gniPerCapita = await getWorldBankIndicator(countryCode, 'NY.GNP.PCAP.CD');
            const lifeExpectancy = await getWorldBankIndicator(countryCode, 'SP.DYN.LE00.IN');
            const povertyRate = await getWorldBankIndicator(countryCode, 'SI.POV.DDAY');

            worldBankData = { gdp, gniPerCapita, lifeExpectancy, povertyRate };

            // Speichere in DB
            await new Promise((resolve, reject) => {
                tableGeoStatistic.setCountryData(
                    db,
                    countryCode,
                    JSON.stringify(countryData),
                    JSON.stringify(worldBankData),
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        }

        // 4. Berechnungen
        const population = countryData.population;
        const area = countryData.area;
        const populationDensity = population && area ? population / area : null;
        const gdpPerCapita = worldBankData.gdp.value && population ? worldBankData.gdp.value / population : null;

        // 5. Zusammenfassung
        response.status = 200;
        response.data = {
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