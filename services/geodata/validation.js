const { categoryNames, subcategoryNames } = require('./categories');

const VALID_CATEGORIES = new Set(categoryNames());

function validateNearbyRequest(body, {
  maxBboxArea = numberSetting('GEODATA_MAX_BBOX_AREA', 0.05),
  maxResults = integerSetting('GEODATA_MAX_RESULTS', 500)
} = {}) {
  if (!isPlainObject(body)) return invalid('invalid_nearby_request');
  const bounds = boundingBox(body.bounds);
  if (!bounds) return invalid('invalid_nearby_bounds');
  if (bboxArea(bounds) <= 0 || bboxArea(bounds) > maxBboxArea) {
    return invalid('nearby_viewport_too_large');
  }

  const categories = Array.isArray(body.categories)
    ? [...new Set(body.categories.map(normalizeString).filter(Boolean))]
    : [];
  if (categories.length < 1 || categories.length > VALID_CATEGORIES.size
      || categories.some((category) => !VALID_CATEGORIES.has(category))) {
    return invalid('invalid_nearby_categories');
  }

  const subcategories = validateSubcategories(body.subcategories, categories);
  if (!subcategories) return invalid('invalid_nearby_subcategories');

  const limit = body.limit === undefined ? Math.min(200, maxResults) : Number(body.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxResults) {
    return invalid('invalid_nearby_limit');
  }
  return { ok: true, value: { bounds, categories, subcategories, limit } };
}

function validateSubcategories(value, categories) {
  if (value === undefined) {
    return Object.fromEntries(categories.map((category) => [category, subcategoryNames(category)]));
  }
  if (!isPlainObject(value) || Object.keys(value).some((category) => !categories.includes(category))) return null;
  const result = {};
  for (const category of categories) {
    const requested = value[category];
    if (!Array.isArray(requested)) return null;
    const normalized = [...new Set(requested.map(normalizeString).filter(Boolean))];
    const allowed = new Set(subcategoryNames(category));
    if (normalized.length < 1 || normalized.some((subcategory) => !allowed.has(subcategory))) return null;
    result[category] = normalized;
  }
  return result;
}

function boundingBox(value) {
  if (!isPlainObject(value)) return null;
  const south = Number(value.south ?? value.latMin);
  const west = Number(value.west ?? value.lonMin);
  const north = Number(value.north ?? value.latMax);
  const east = Number(value.east ?? value.lonMax);
  if (!Number.isFinite(south) || !Number.isFinite(west)
      || !Number.isFinite(north) || !Number.isFinite(east)
      || south < -90 || north > 90 || south >= north
      || west < -180 || east > 180 || west >= east) return null;
  return { south, west, north, east };
}

function bboxArea(bounds) {
  return (bounds.north - bounds.south) * (bounds.east - bounds.west);
}

function numberSetting(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function integerSetting(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message) {
  return { ok: false, message };
}

module.exports = { validateNearbyRequest, validateSubcategories, boundingBox, bboxArea };
