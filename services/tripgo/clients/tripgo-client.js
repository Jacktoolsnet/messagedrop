const axios = require('axios');

const DEFAULT_BASE_URL = 'https://api.tripgo.com/v1';

function createTripGoClient({
  apiKey = process.env.TRIPGO_API_KEY,
  baseURL = process.env.TRIPGO_API_BASE_URL || DEFAULT_BASE_URL,
  timeout = Number(process.env.TRIPGO_API_TIMEOUT_MS || 15000)
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('TRIPGO_API_KEY is not set');
  }
  const normalizedBaseUrl = normalizeHttpsBaseUrl(baseURL);
  const normalizedTimeout = Number.isFinite(timeout) && timeout > 0 ? Math.round(timeout) : 15000;
  const http = axios.create({
    baseURL: normalizedBaseUrl,
    timeout: normalizedTimeout,
    maxContentLength: Number(process.env.TRIPGO_MAX_RESPONSE_BYTES || 10 * 1024 * 1024),
    headers: {
      Accept: 'application/json',
      'X-TripGo-Key': apiKey.trim()
    }
  });

  return {
    async health() {
      return unwrap(await http.get('/regions.json', {
        headers: { 'X-TripGo-HealthCheck': 'true' }
      }));
    },

    async regions(locale = 'en') {
      return unwrap(await http.post('/regions.json', { v: 2 }, {
        headers: { 'Accept-Language': locale }
      }));
    },

    async routes(query) {
      const params = new URLSearchParams();
      params.set('from', coordinate(query.from));
      params.set('to', coordinate(query.to));
      params.set('v', '11');
      params.set('locale', query.locale);
      for (const mode of query.modes) params.append('modes', mode);
      if (query.time) params.set(query.time.type, String(query.time.epochSeconds));
      for (const stop of query.avoidStops) params.append('avoidStops', stop);
      return unwrap(await http.get(`/routing.json?${params.toString()}`));
    }
  };
}

function normalizeHttpsBaseUrl(value) {
  const parsed = new URL(String(value || DEFAULT_BASE_URL));
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) {
    throw new Error('TRIPGO_API_BASE_URL must use HTTPS');
  }
  return parsed.toString().replace(/\/+$/, '');
}

function coordinate(value) {
  return `(${value.latitude},${value.longitude})`;
}

function unwrap(response) {
  return {
    data: response.data,
    status: response.status,
    headers: response.headers
  };
}

module.exports = { createTripGoClient, normalizeHttpsBaseUrl };
