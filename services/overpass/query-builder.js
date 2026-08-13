const { selectedDefinitions } = require('./categories');

function buildNearbyQuery({ bounds, categories, subcategories = {}, limit }, {
  timeoutSeconds = Number(process.env.OVERPASS_QUERY_TIMEOUT_SECONDS || 15)
} = {}) {
  const timeout = Number.isInteger(timeoutSeconds) && timeoutSeconds > 0 && timeoutSeconds <= 180
    ? timeoutSeconds
    : 15;
  const bbox = [bounds.south, bounds.west, bounds.north, bounds.east]
    .map(formatCoordinate).join(',');
  const clauses = [];
  for (const category of categories) {
    for (const definition of selectedDefinitions(category, subcategories[category])) {
      for (const value of definition.values) {
        const exclusions = definition.exclude.map(({ key, values }) =>
          `[${quote(key)}!~${quote(`^(${values.map(escapeRegex).join('|')})$`)}]`).join('');
        clauses.push(`  nwr[${quote(definition.key)}=${quote(value)}]${exclusions}(${bbox});`);
      }
    }
  }
  return [
    `[out:json][timeout:${timeout}];`,
    '(',
    ...clauses,
    ');',
    `out tags center qt ${limit};`
  ].join('\n');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function formatCoordinate(value) {
  return String(Number(Number(value).toFixed(7)));
}

function quote(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

module.exports = { buildNearbyQuery, formatCoordinate };
