const { categoryForTags } = require('./categories');

function normalizeGeodataResponse(payload, requestedCategories, requestedSubcategories = {}) {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  return elements.map((element) => normalizeElement(element, requestedCategories, requestedSubcategories)).filter(Boolean);
}

function normalizeElement(element, requestedCategories, requestedSubcategories = {}) {
  if (!element || !['node', 'way', 'relation'].includes(element.type)
      || !Number.isSafeInteger(Number(element.id))) return null;
  const latitude = finiteCoordinate(element.lat ?? element.center?.lat, -90, 90);
  const longitude = finiteCoordinate(element.lon ?? element.center?.lon, -180, 180);
  if (latitude === null || longitude === null) return null;
  const tags = plainTags(element.tags);
  const classification = categoryForTags(tags, requestedCategories, requestedSubcategories);
  if (!classification) return null;
  return {
    id: `osm:${element.type}:${element.id}`,
    osmType: element.type,
    osmId: Number(element.id),
    category: classification.category,
    subtype: classification.subcategory,
    name: firstText(tags.name, tags['name:en'], tags.brand, tags.operator),
    latitude,
    longitude,
    address: compact({
      street: firstText(tags['addr:street'], tags['addr:place']),
      houseNumber: firstText(tags['addr:housenumber']),
      postcode: firstText(tags['addr:postcode']),
      city: firstText(tags['addr:city'], tags['addr:town'], tags['addr:village']),
      country: firstText(tags['addr:country'])
    }),
    contact: compact({
      phone: firstText(tags['contact:phone'], tags.phone),
      website: firstText(tags['contact:website'], tags.website),
      email: firstText(tags['contact:email'], tags.email)
    }),
    properties: compact({
      stars: firstText(tags.stars),
      rooms: firstText(tags.rooms),
      beds: firstText(tags.beds),
      wheelchair: firstText(tags.wheelchair),
      openingHours: firstText(tags.opening_hours),
      description: firstText(tags.description),
      descriptions: localizedTags(tags, 'description'),
      inscription: firstText(tags.inscription),
      inscriptions: localizedTags(tags, 'inscription'),
      wikidata: firstText(tags.wikidata),
      wikipedia: firstText(tags.wikipedia)
    }),
    source: {
      provider: 'OpenStreetMap',
      url: `https://www.openstreetmap.org/${element.type}/${element.id}`
    }
  };
}

function plainTags(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key, tag]) => typeof key === 'string' && typeof tag === 'string'));
}

function finiteCoordinate(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
}

function localizedTags(tags, key) {
  const values = compact(Object.fromEntries(['de', 'en', 'es', 'fr']
    .map((language) => [language, firstText(tags[`${key}:${language}`])])));
  return Object.keys(values).length ? values : null;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
}

module.exports = { normalizeGeodataResponse, normalizeElement };
