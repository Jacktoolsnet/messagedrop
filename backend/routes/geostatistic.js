const CACHE_TTL_DAYS = 30;
const express = require('express');
const router = express.Router();
const axios = require('axios');
const security = require('../middleware/security');
const { getCountryCodeFromNominatim } = require('../utils/nominatimQueue');
const tableGeoStatistic = require('../db/tableGeoStatistic');
const tableWeatherHistory = require('../db/tableWeatherHistory');

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

router.get('/:pluscode/:latitude/:longitude/:years', [security.checkToken], async (req, res) => {
    let response = { status: 0 };
    const db = req.database.db;

    try {
        const { pluscode, latitude, longitude, years } = req.params;

        const nominatimData = await getCountryCodeFromNominatim(latitude, longitude);
        const address = nominatimData.address;
        const countryAlpha2 = address?.country_code?.toUpperCase();
        if (!countryAlpha2) throw new Error('Country code not found');

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

        if (!countryData || !worldBankData) {
            const restCountriesResponse = await axios.get(`https://restcountries.com/v3.1/alpha/${countryAlpha2}`);
            countryData = restCountriesResponse.data[0];
            const countryAlpha3 = countryData.cca3;
            if (!countryAlpha3) throw new Error('Alpha-3 country code not found');

            // --- Load raw indicators ---
            const gdp = await getWorldBankIndicator(countryAlpha3, 'NY.GDP.MKTP.CD', years);
            const population = await getWorldBankIndicator(countryAlpha3, 'SP.POP.TOTL', years);
            const energyUse = await getWorldBankIndicator(countryAlpha3, 'EG.USE.PCAP.KG.OE', years);

            const gdpPerCapita = gdp.map(gdpEntry => {
                const popEntry = population.find(p => p.year === gdpEntry.year);
                const popValue = popEntry?.value ?? null;
                return {
                    year: gdpEntry.year,
                    value: popValue ? gdpEntry.value / popValue : null
                };
            });

            const gniPerCapita = await getWorldBankIndicator(countryAlpha3, 'NY.GNP.PCAP.CD', years);
            const militaryExpenditure = await getWorldBankIndicator(countryAlpha3, 'MS.MIL.XPND.GD.ZS', years);
            const governmentSpending = await getWorldBankIndicator(countryAlpha3, 'GC.XPN.TOTL.GD.ZS', years);
            const inflation = await getWorldBankIndicator(countryAlpha3, 'FP.CPI.TOTL.ZG', years);
            const unemployment = await getWorldBankIndicator(countryAlpha3, 'SL.UEM.TOTL.ZS', years);
            const investment = await getWorldBankIndicator(countryAlpha3, 'NE.GDI.TOTL.ZS', years);
            const lifeExpectancy = await getWorldBankIndicator(countryAlpha3, 'SP.DYN.LE00.IN', years);
            const povertyRate = await getWorldBankIndicator(countryAlpha3, 'SI.POV.DDAY', years);
            const literacyRate = await getWorldBankIndicator(countryAlpha3, 'SE.ADT.LITR.ZS', years);
            const primaryEnrollment = await getWorldBankIndicator(countryAlpha3, 'SE.PRM.ENRR', years);
            const secondaryEnrollment = await getWorldBankIndicator(countryAlpha3, 'SE.SEC.ENRR', years);
            const giniIndex = await getWorldBankIndicator(countryAlpha3, 'SI.POV.GINI', years);
            const co2Emissions = await getWorldBankIndicator(countryAlpha3, 'EN.ATM.CO2E.KT', years);
            const renewableEnergy = await getWorldBankIndicator(countryAlpha3, 'EG.FEC.RNEW.ZS', years);
            const forestArea = await getWorldBankIndicator(countryAlpha3, 'AG.LND.FRST.ZS', years);
            const airPollution = await getWorldBankIndicator(countryAlpha3, 'EN.ATM.PM25.MC.M3', years);

            // --- Convert percentage values to absolute ---
            const militaryExpenditureAbs = militaryExpenditure.map(entry => {
                const gdpEntry = gdp.find(g => g.year === entry.year);
                return {
                    year: entry.year,
                    value: gdpEntry && entry.value !== null ? (entry.value / 100) * gdpEntry.value : null
                };
            });

            const governmentSpendingAbs = governmentSpending.map(entry => {
                const gdpEntry = gdp.find(g => g.year === entry.year);
                return {
                    year: entry.year,
                    value: gdpEntry && entry.value !== null ? (entry.value / 100) * gdpEntry.value : null
                };
            });

            const povertyRateAbs = povertyRate.map(entry => {
                const popEntry = population.find(p => p.year === entry.year);
                return {
                    year: entry.year,
                    value: popEntry && entry.value !== null ? (entry.value / 100) * popEntry.value : null
                };
            });

            const renewableEnergyAbs = renewableEnergy.map(entry => {
                const energyEntry = energyUse.find(e => e.year === entry.year);
                return {
                    year: entry.year,
                    value: energyEntry && entry.value !== null ? (entry.value / 100) * energyEntry.value : null
                };
            });

            worldBankData = {
                gdp,
                population,
                gdpPerCapita,
                gniPerCapita,
                militaryExpenditure: militaryExpenditureAbs,
                governmentSpending: governmentSpendingAbs,
                inflation,
                unemployment,
                investment,
                lifeExpectancy,
                povertyRate: povertyRateAbs,
                literacyRate,
                primaryEnrollment,
                secondaryEnrollment,
                giniIndex,
                co2Emissions,
                renewableEnergy: renewableEnergyAbs,
                forestArea,
                airPollution,
                energyUse
            };

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

        const reducedPluscode = pluscode.substring(0, 8); // ≈100m Genauigkeit
        const cacheKey = `${reducedPluscode}`;
        let weatherHistoryData = await new Promise((resolve, reject) => {
            tableWeatherHistory.getHistoryData(db, cacheKey, (err, row) => {
                if (err) return reject(err);
                resolve(row ? JSON.parse(row.historyData) : null);
            });
        });

        if (!weatherHistoryData) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(endDate.getFullYear() - years);
            const weatherRes = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
                params: {
                    latitude,
                    longitude,
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0],
                    daily: 'temperature_2m_mean,precipitation_sum',
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

        let temperatureTrend = [];
        let precipitationTrend = [];
        if (weatherHistoryData.daily && Array.isArray(weatherHistoryData.daily.time)) {
            const dailyData = weatherHistoryData.daily;
            const startYear = new Date(dailyData.time[0]).getFullYear();
            const endYear = new Date(dailyData.time[dailyData.time.length - 1]).getFullYear();

            for (let year = startYear; year <= endYear; year++) {
                const yearData = dailyData.time
                    .map((date, index) => ({
                        date,
                        temp: dailyData.temperature_2m_mean[index],
                        precip: dailyData.precipitation_sum[index]
                    }))
                    .filter(entry => new Date(entry.date).getFullYear() === year);
                if (yearData.length > 0) {
                    const avgTemp = yearData.reduce((sum, e) => sum + e.temp, 0) / yearData.length;
                    const totalPrecip = yearData.reduce((sum, e) => sum + e.precip, 0);
                    temperatureTrend.push({ year: String(year), value: avgTemp });
                    precipitationTrend.push({ year: String(year), value: totalPrecip });
                }
            }
        }

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
            weatherHistory: {
                latitude: weatherHistoryData.latitude,
                longitude: weatherHistoryData.longitude,
                elevation: weatherHistoryData.elevation,
                timezone: weatherHistoryData.timezone,
                temperatureTrend,
                precipitationTrend
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