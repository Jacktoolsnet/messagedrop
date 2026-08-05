const MODE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+){1,5}$/i;
const STOP_PATTERN = /^[a-zA-Z0-9_.:-]{1,160}$/;

function validateRouteRequest(body) {
  if (!isPlainObject(body)) return invalid('invalid_route_request');
  const from = location(body.from);
  const to = location(body.to);
  if (!from || !to) return invalid('invalid_route_locations');

  const locale = normalizeLocale(body.locale ?? 'de');
  if (!locale) return invalid('invalid_route_locale');

  const modes = Array.isArray(body.modes) ? [...new Set(body.modes.map(normalizeString))] : [];
  if (modes.length < 1 || modes.length > 12 || modes.some((mode) => !MODE_PATTERN.test(mode))) {
    return invalid('invalid_route_modes');
  }

  const avoidStops = body.avoidStops === undefined
    ? []
    : Array.isArray(body.avoidStops) ? [...new Set(body.avoidStops.map(normalizeString))] : null;
  if (!avoidStops || avoidStops.length > 20 || avoidStops.some((stop) => !STOP_PATTERN.test(stop))) {
    return invalid('invalid_avoid_stops');
  }

  const time = normalizeTime(body.time);
  if (time === false) return invalid('invalid_route_time');
  return { ok: true, value: { from, to, locale, modes, avoidStops, time } };
}

function normalizeLocale(value) {
  const normalized = normalizeString(value).replace('_', '-');
  return /^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(normalized) ? normalized : null;
}

function normalizeTime(value) {
  if (value === undefined || value === null) return null;
  if (!isPlainObject(value) || !['departAfter', 'arriveBefore'].includes(value.type)) return false;
  const timestamp = typeof value.value === 'number' ? value.value : Date.parse(value.value);
  const milliseconds = typeof value.value === 'number' && value.value < 10_000_000_000
    ? value.value * 1000
    : timestamp;
  if (!Number.isFinite(milliseconds)) return false;
  const epochSeconds = Math.floor(milliseconds / 1000);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (epochSeconds < nowSeconds - 24 * 60 * 60 || epochSeconds > nowSeconds + 366 * 24 * 60 * 60) return false;
  return { type: value.type, epochSeconds };
}

function location(value) {
  if (!isPlainObject(value)) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message) {
  return { ok: false, message };
}

module.exports = { validateRouteRequest, normalizeLocale };
