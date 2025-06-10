const axios = require('axios');

const queue = [];
let interval = null;

async function processQueue() {
    if (queue.length === 0) {
        clearInterval(interval);
        interval = null;
        return;
    }

    const job = queue.shift();
    try {
        let result;

        if (job.type === 'reverse') {
            result = await axios.get('https://nominatim.openstreetmap.org/reverse', {
                params: {
                    lat: job.lat,
                    lon: job.lon,
                    format: 'json',
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': process.env.NOMINATIM_USER_AGENT || 'DefaultAppName/1.0'
                }
            });
        } else if (job.type === 'search') {
            const params = {
                q: job.text,
                format: 'json',
                addressdetails: 1,
                limit: job.limit ?? 1
            };

            // optionale Parameter einfügen
            if (job.options?.viewbox) {
                params.viewbox = job.options.viewbox;
            }
            if (job.options?.bounded) {
                params.bounded = job.options.bounded;
            }

            result = await axios.get('https://nominatim.openstreetmap.org/search', {
                params,
                headers: {
                    'User-Agent': process.env.NOMINATIM_USER_AGENT || 'DefaultAppName/1.0'
                }
            });
        }

        job.resolve(result.data);
    } catch (err) {
        job.reject(err);
    }
}

function getCountryCodeFromNominatim(lat, lon) {
    return new Promise((resolve, reject) => {
        queue.push({ type: 'reverse', lat, lon, resolve, reject });
        if (!interval) interval = setInterval(processQueue, 1000);
    });
}

function getPlaceFromNominatimText(text, limit = 1, options = {}) {
    return new Promise((resolve, reject) => {
        queue.push({ type: 'search', text, limit, options, resolve, reject });
        if (!interval) interval = setInterval(processQueue, 1000);
    });
}

module.exports = {
    getCountryCodeFromNominatim,
    getPlaceFromNominatimText
};