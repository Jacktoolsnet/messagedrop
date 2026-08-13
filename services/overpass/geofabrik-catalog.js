const fs = require('node:fs/promises');
const path = require('node:path');
const axios = require('axios');

const INDEX_URL = 'https://download.geofabrik.de/index-v1-nogeom.json';
const CONTINENTS = Object.freeze({
  africa: { code: 'AF', label: 'Africa' },
  antarctica: { code: 'AN', label: 'Antarctica' },
  asia: { code: 'AS', label: 'Asia' },
  'australia-oceania': { code: 'OC', label: 'Australia and Oceania' },
  'central-america': { code: 'CA', label: 'Central America' },
  europe: { code: 'EU', label: 'Europe' },
  'north-america': { code: 'NA', label: 'North America' },
  'south-america': { code: 'SA', label: 'South America' }
});

const FALLBACK_DATASETS = Object.freeze({
  germany: Object.freeze({
    id: 'germany', label: 'Germany', continentCode: 'EU', continentLabel: 'Europe',
    countryCode: 'DE', countryLabel: 'Germany', regionCode: null, level: 'country',
    supersedes: Object.freeze(['wolfenbuettel']),
    sourceUrl: 'https://download.geofabrik.de/europe/germany-latest.osm.pbf',
    sourceFile: 'germany-latest.osm.pbf'
  }),
  wolfenbuettel: Object.freeze({
    id: 'wolfenbuettel', label: 'Wolfenbüttel', continentCode: 'EU', continentLabel: 'Europe',
    countryCode: 'DE', countryLabel: 'Germany', regionCode: 'DE-NI', level: 'test', clipToBounds: true,
    sourceUrl: 'https://download.geofabrik.de/europe/germany/niedersachsen-latest.osm.pbf',
    sourceFile: 'niedersachsen-latest.osm.pbf',
    bounds: Object.freeze({ south: 52.05, west: 10.40, north: 52.30, east: 10.75 })
  })
});

function safeId(value) {
  return String(value).toLowerCase().replaceAll('/', '--').replace(/[^a-z0-9_-]/g, '-');
}

function array(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : value ? [String(value)] : [];
}

function buildCatalog(index) {
  const features = Array.isArray(index?.features) ? index.features : [];
  const properties = features.map((feature) => feature?.properties).filter(Boolean);
  const byId = new Map(properties.map((item) => [item.id, item]));
  const countryCodes = new Map();
  for (const item of properties) {
    const codes = array(item['iso3166-1:alpha2']);
    if (codes.length) countryCodes.set(item.id, codes);
  }

  const continentFor = (item) => {
    let current = item;
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (CONTINENTS[current.id]) return CONTINENTS[current.id];
      current = byId.get(current.parent);
    }
    return null;
  };
  const parentCountry = (item) => {
    const parent = byId.get(item.parent);
    return parent && countryCodes.has(parent.id) ? parent : null;
  };

  const definitions = {};
  const display = [];
  for (const item of properties) {
    const sourceUrl = item.urls?.pbf;
    if (!sourceUrl) continue;
    const ownCodes = countryCodes.get(item.id) || [];
    const country = ownCodes.length ? item : parentCountry(item);
    const codes = ownCodes.length ? ownCodes : (countryCodes.get(country?.id) || []);
    const continent = continentFor(item);
    if (!country || !codes.length || !continent) continue;
    const id = safeId(item.id);
    const level = ownCodes.length ? 'country' : 'state';
    const definition = {
      id,
      label: String(item.name || item.id),
      continentCode: continent.code,
      continentLabel: continent.label,
      countryCode: codes[0],
      countryLabel: String(country.name || codes[0]),
      regionCode: level === 'state' ? (array(item['iso3166-2'])[0] || item.id) : null,
      level,
      sourceUrl,
      sourceFile: path.basename(new URL(sourceUrl).pathname)
    };
    if (id === 'germany') definition.supersedes = ['wolfenbuettel'];
    definitions[id] = definition;
    if (level === 'country') {
      for (const countryCode of codes) display.push({ ...definition, countryCode });
    }
  }
  display.sort((left, right) => left.continentLabel.localeCompare(right.continentLabel)
    || left.countryCode.localeCompare(right.countryCode) || (left.level === 'country' ? -1 : 1)
    || left.label.localeCompare(right.label));
  // Keep the former test extract executable for already queued jobs, but do not
  // advertise it in the administration catalog anymore.
  definitions.wolfenbuettel ||= FALLBACK_DATASETS.wolfenbuettel;
  return { definitions, display };
}

class GeofabrikCatalog {
  constructor({ logger = console, cachePath, ttlMs, client } = {}) {
    this.logger = logger;
    this.cachePath = cachePath || path.resolve(__dirname, '../../docs/overpass/datasets/geofabrik-index-v1-nogeom.json');
    this.ttlMs = Number(ttlMs || process.env.OVERPASS_GEOFABRIK_CATALOG_TTL_MS || 24 * 60 * 60 * 1000);
    this.client = client || axios;
    this.value = null;
    this.loadedAt = 0;
    this.loading = null;
  }

  async get({ refresh = false } = {}) {
    if (!refresh && this.value && Date.now() - this.loadedAt < this.ttlMs) return this.value;
    if (this.loading) return this.loading;
    this.loading = this.load(refresh).finally(() => { this.loading = null; });
    return this.loading;
  }

  async load(refresh) {
    if (!refresh) {
      try {
        const stat = await fs.stat(this.cachePath);
        const cached = buildCatalog(JSON.parse(await fs.readFile(this.cachePath, 'utf8')));
        if (Object.keys(cached.definitions).length) {
          this.value = cached;
          this.loadedAt = stat.mtimeMs;
          if (Date.now() - stat.mtimeMs < this.ttlMs) return cached;
        }
      } catch { /* no usable persistent cache yet */ }
    }
    try {
      const response = await this.client.get(INDEX_URL, { timeout: 10000, maxContentLength: 5 * 1024 * 1024 });
      const next = buildCatalog(response.data);
      if (!Object.keys(next.definitions).length) throw new Error('empty_geofabrik_catalog');
      await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
      await fs.writeFile(this.cachePath, `${JSON.stringify(response.data)}\n`, { mode: 0o600 });
      this.value = next;
      this.loadedAt = Date.now();
      return next;
    } catch (error) {
      if (this.value) {
        this.logger.warn('Could not refresh Geofabrik catalog; using cached catalog', { error: error.message });
        this.loadedAt = Date.now();
        return this.value;
      }
      this.logger.warn('Could not load Geofabrik catalog; using built-in fallback', { error: error.message });
      const definitions = { ...FALLBACK_DATASETS };
      return { definitions, display: [definitions.germany] };
    }
  }
}

module.exports = { CONTINENTS, FALLBACK_DATASETS, GeofabrikCatalog, buildCatalog, safeId };
