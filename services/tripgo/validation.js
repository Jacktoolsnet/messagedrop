const MODE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+){1,5}$/i;
const STOP_PATTERN = /^[a-zA-Z0-9_.:-]{1,160}$/;
const REGION_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;
const SERVICE_ID_PATTERN = /^[a-zA-Z0-9_.:|/-]{1,240}$/;

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

function validateServiceRequest(body) {
  if (!isPlainObject(body)) return invalid('invalid_service_request');
  const region = normalizeString(body.region);
  const serviceTripId = normalizeString(body.serviceTripId);
  const startStopCode = normalizeString(body.startStopCode);
  const endStopCode = normalizeString(body.endStopCode);
  const operator = normalizeString(body.operator);
  const locale = normalizeLocale(body.locale ?? 'de');
  if (!REGION_PATTERN.test(region)) return invalid('invalid_service_region');
  if (!SERVICE_ID_PATTERN.test(serviceTripId)) return invalid('invalid_service_trip_id');
  if (!STOP_PATTERN.test(startStopCode)) return invalid('invalid_service_start_stop');
  if (endStopCode && !STOP_PATTERN.test(endStopCode)) return invalid('invalid_service_end_stop');
  if (operator.length > 200) return invalid('invalid_service_operator');
  if (!locale) return invalid('invalid_service_locale');
  const embarkationMs = typeof body.embarkationTime === 'number'
    ? (body.embarkationTime < 10_000_000_000 ? body.embarkationTime * 1000 : body.embarkationTime)
    : Date.parse(body.embarkationTime);
  if (!Number.isFinite(embarkationMs)) return invalid('invalid_service_embarkation_time');
  const embarkationTime = Math.floor(embarkationMs / 1000);
  const now = Math.floor(Date.now() / 1000);
  if (embarkationTime < now - 7 * 86400 || embarkationTime > now + 366 * 86400) {
    return invalid('invalid_service_embarkation_time');
  }
  return { ok: true, value: {
    region, serviceTripId, startStopCode, endStopCode: endStopCode || null,
    operator: operator || null, embarkationTime, locale
  } };
}

function validateLatestRequest(body) {
  const result = validateServiceRequest(body);
  if (!result.ok) return result;
  if (!result.value.operator) return invalid('invalid_latest_operator');
  return result;
}

function validateRegionRequest(value) {
  if (!isPlainObject(value)) return invalid('invalid_region_request');
  const region = normalizeString(value.region);
  const locale = normalizeLocale(value.locale ?? 'en');
  if (!REGION_PATTERN.test(region)) return invalid('invalid_region');
  if (!locale) return invalid('invalid_region_locale');
  const onlyRealTime = optionalBoolean(value.onlyRealTime, false);
  const full = optionalBoolean(value.full, true);
  if (onlyRealTime === null || full === null) return invalid('invalid_region_options');
  return { ok: true, value: { region, locale, onlyRealTime, full } };
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

function optionalBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return null;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message) {
  return { ok: false, message };
}

module.exports = {
  validateRouteRequest,
  validateServiceRequest,
  validateLatestRequest,
  validateRegionRequest,
  normalizeLocale
};
