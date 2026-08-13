#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const PRIMARY_KEYS = ['tourism', 'leisure', 'amenity', 'historic'];
const COVERAGE_FIELDS = {
  name: ['name'],
  address: ['addr:street', 'addr:place', 'addr:housenumber', 'addr:postcode', 'addr:city'],
  website: ['contact:website', 'website'],
  phone: ['contact:phone', 'phone'],
  email: ['contact:email', 'email'],
  openingHours: ['opening_hours'],
  stars: ['stars'],
  rooms: ['rooms'],
  beds: ['beds'],
  wheelchair: ['wheelchair'],
  wikidata: ['wikidata'],
  wikipedia: ['wikipedia']
};

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath) throw new Error('Input path is required');
  const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const report = analyze(payload);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, json, { mode: 0o600 });
    process.stdout.write(`Overpass POI analysis written to ${outputPath}\n`);
  } else {
    process.stdout.write(json);
  }
}

function analyze(payload) {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  const tagged = elements.filter((element) => isObject(element?.tags));
  const withCoordinates = elements.filter(hasCoordinates);
  const tagFrequency = countBy(tagged.flatMap((element) => Object.keys(element.tags)), (key) => key);
  const primaryValues = {};
  for (const key of PRIMARY_KEYS) {
    primaryValues[key] = countBy(tagged
      .map((element) => element.tags[key]).filter(nonEmptyString), (value) => value);
  }
  const coverage = Object.fromEntries(Object.entries(COVERAGE_FIELDS).map(([name, keys]) => {
    const count = tagged.filter((element) => keys.some((key) => nonEmptyString(element.tags[key]))).length;
    return [name, { count, percent: percentage(count, tagged.length) }];
  }));
  const duplicateCandidates = possibleDuplicates(elements);
  return {
    analyzedAt: new Date().toISOString(),
    osmBaseTimestamp: payload?.osm3s?.timestamp_osm_base || null,
    counts: {
      elements: elements.length,
      tagged: tagged.length,
      withCoordinates: withCoordinates.length,
      missingCoordinates: elements.length - withCoordinates.length,
      byElementType: countBy(elements, (element) => element?.type || 'unknown')
    },
    primaryValues,
    coverage,
    topAdditionalTags: Object.entries(tagFrequency)
      .filter(([key]) => !PRIMARY_KEYS.includes(key))
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 50)
      .map(([key, count]) => ({ key, count, percent: percentage(count, tagged.length) })),
    possibleDuplicates: {
      count: duplicateCandidates.length,
      distanceMeters: 75,
      candidates: duplicateCandidates.slice(0, 100)
    }
  };
}

function possibleDuplicates(elements) {
  const named = elements.map((element) => ({
    id: elementId(element),
    name: element?.tags?.name,
    normalizedName: normalizeName(element?.tags?.name),
    coordinate: coordinate(element)
  })).filter((element) => element.id && element.normalizedName && element.coordinate);
  const candidates = [];
  for (let leftIndex = 0; leftIndex < named.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < named.length; rightIndex += 1) {
      const left = named[leftIndex];
      const right = named[rightIndex];
      if (left.normalizedName !== right.normalizedName) continue;
      const distanceMeters = haversineMeters(left.coordinate, right.coordinate);
      if (distanceMeters <= 75) {
        candidates.push({ left: left.id, right: right.id, name: left.name, distanceMeters: Math.round(distanceMeters) });
      }
    }
  }
  return candidates.sort((left, right) => left.distanceMeters - right.distanceMeters);
}

function coordinate(element) {
  const latitude = Number(element?.lat ?? element?.center?.lat);
  const longitude = Number(element?.lon ?? element?.center?.lon);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function hasCoordinates(element) {
  return coordinate(element) !== null;
}

function elementId(element) {
  return ['node', 'way', 'relation'].includes(element?.type) && Number.isFinite(Number(element?.id))
    ? `osm:${element.type}:${element.id}` : null;
}

function normalizeName(value) {
  return nonEmptyString(value)
    ? value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim()
    : '';
}

function haversineMeters(left, right) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function countBy(values, keySelector) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    const key = String(keySelector(value));
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
}

function percentage(count, total) {
  return total > 0 ? Number((count * 100 / total).toFixed(1)) : 0;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Could not analyze Overpass POIs: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { analyze, normalizeName, haversineMeters };
