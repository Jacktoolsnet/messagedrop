const axios = require('axios');

const queue = [];
let interval = null;

async function processQueue() {
    if (queue.length === 0) {
        clearInterval(interval);
        interval = null;
        return;
    }

    const { lat, lon, resolve, reject } = queue.shift();

    try {
        const result = await axios.get('https://nominatim.openstreetmap.org/reverse', {
            params: {
                lat,
                lon,
                format: 'json'
            },
            headers: {
                'User-Agent': process.env.NOMINATIM_USER_AGENT || 'DefaultAppName/1.0'
            }
        });
        resolve(result.data);
    } catch (err) {
        reject(err);
    }
}

function getCountryCodeFromNominatim(lat, lon) {
    return new Promise((resolve, reject) => {
        queue.push({ lat, lon, resolve, reject });

        // Starte den Intervall-Worker nur, wenn er noch nicht läuft
        if (!interval) {
            interval = setInterval(processQueue, 1000);
        }
    });
}

module.exports = { getCountryCodeFromNominatim };