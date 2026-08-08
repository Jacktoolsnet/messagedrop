const CELLS_PER_DEGREE = 75;

function cellIDsForBounds(bounds) {
  const cells = new Set();
  for (const box of bounds) {
    const minLatitudeCell = Math.floor(box.latMin * CELLS_PER_DEGREE);
    const maxLatitudeCell = Math.floor(box.latMax * CELLS_PER_DEGREE);
    const minLongitudeCell = Math.floor(box.lonMin * CELLS_PER_DEGREE);
    const maxLongitudeCell = Math.floor(box.lonMax * CELLS_PER_DEGREE);
    for (let latitude = minLatitudeCell; latitude <= maxLatitudeCell; latitude += 1) {
      for (let longitude = minLongitudeCell; longitude <= maxLongitudeCell; longitude += 1) {
        cells.add(`${latitude}#${longitude}`);
      }
    }
  }
  return [...cells].sort();
}

function resolveRegion(regionsPayload, bounds) {
  const regions = Array.isArray(regionsPayload?.regions) ? regionsPayload.regions : [];
  const center = boundsCenter(bounds);
  const candidates = regions.flatMap((region) => {
    if (typeof region?.name !== 'string' || typeof region?.polygon !== 'string') return [];
    if (Array.isArray(region.modes) && !region.modes.some((mode) => String(mode).startsWith('pt_'))) return [];
    const polygon = decodePolyline(region.polygon);
    if (polygon.length < 3 || !pointInPolygon(center, polygon)) return [];
    return [{ name: region.name, area: polygonBoundingArea(polygon, center.longitude) }];
  });
  candidates.sort((left, right) => left.area - right.area);
  return candidates[0]?.name || null;
}

function normalizeLocationsResponse(payload, region, bounds) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.groups)) {
    const error = new Error('invalid_tripgo_locations_response');
    error.status = 502;
    throw error;
  }
  const normalizedStopsWithDuplicates = payload.groups
    .flatMap((group) => Array.isArray(group?.stops) ? group.stops.flatMap(flattenLocationStop) : [])
    .map(normalizeStop)
    .filter((stop) => stop && pointInBounds(stop, bounds));
  const normalizedStops = [...new Map(normalizedStopsWithDuplicates.map((stop) => [
    `${stop.region || region}|${stop.stopCode}`, stop
  ])).values()];
  const groups = [];
  for (const stop of normalizedStops) {
    let group = groups.find((candidate) => candidate.normalizedName === normalizeName(stop.name)
      && distanceMetres(candidate, stop) <= 250);
    if (!group) {
      group = {
        normalizedName: normalizeName(stop.name),
        name: stop.name,
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        coordinateCount: 0,
        region: stop.region || region,
        modeIdentifiers: new Set(),
        modeIcons: new Set(),
        modeLabels: new Set(),
        stopTypes: new Set(),
        services: new Set(),
        operators: new Map(),
        platforms: new Map()
      };
      groups.push(group);
    }
    group.latitude = ((group.latitude * group.coordinateCount) + stop.latitude) / (group.coordinateCount + 1);
    group.longitude = ((group.longitude * group.coordinateCount) + stop.longitude) / (group.coordinateCount + 1);
    group.coordinateCount += 1;
    if (stop.modeIdentifier) group.modeIdentifiers.add(stop.modeIdentifier);
    if (stop.modeIcon) group.modeIcons.add(stop.modeIcon);
    if (stop.modeLabel) group.modeLabels.add(stop.modeLabel);
    if (stop.stopType) group.stopTypes.add(stop.stopType);
    stop.services.forEach((service) => group.services.add(service));
    stop.operators.forEach((operator) => group.operators.set(operator.id || operator.name, operator));
    group.platforms.set(stop.stopCode, stop);
  }
  return {
    region,
    stops: groups.map((group) => ({
      id: `${group.region}|${[...group.platforms.keys()].sort().join('|')}`,
      name: group.name,
      address: group.address,
      latitude: roundCoordinate(group.latitude),
      longitude: roundCoordinate(group.longitude),
      region: group.region,
      modeIdentifiers: [...group.modeIdentifiers].sort(),
      modeIcons: [...group.modeIcons].sort(),
      modeLabels: [...group.modeLabels].sort(),
      stopTypes: [...group.stopTypes].sort(),
      services: [...group.services].sort(naturalCompare),
      operators: [...group.operators.values()].sort((left, right) => left.name.localeCompare(right.name)),
      platforms: [...group.platforms.values()]
        .sort((left, right) => naturalCompare(left.platform || left.stopCode, right.platform || right.stopCode))
        .map((platform) => ({
          stopCode: platform.stopCode,
          platform: platform.platform,
          latitude: platform.latitude,
          longitude: platform.longitude,
          services: platform.services
        }))
    }))
  };
}

function flattenLocationStop(stop) {
  if (!stop || typeof stop !== 'object') return [];
  const children = Array.isArray(stop.children) ? stop.children.flatMap(flattenLocationStop) : [];
  return [stop, ...children];
}

function normalizeStop(stop) {
  const latitude = Number(stop?.lat);
  const longitude = Number(stop?.lng);
  const name = cleanString(stop?.name || stop?.address);
  const stopCode = cleanString(stop?.stopCode || stop?.code);
  if (!name || !stopCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const services = cleanString(stop.services).split(',').map((value) => value.trim()).filter(Boolean);
  const operators = (Array.isArray(stop.operators) ? stop.operators : []).flatMap((operator) => {
    const operatorName = cleanString(operator?.name);
    if (!operatorName) return [];
    return [{ id: cleanString(operator.id), name: operatorName }];
  });
  return {
    name,
    address: cleanString(stop.address),
    latitude,
    longitude,
    region: cleanString(stop.region),
    stopCode,
    platform: cleanString(stop.platform || stop.platformCode || stop.shortName || inferPlatform(stopCode)),
    modeIdentifier: cleanString(stop.publicTransportMode || stop.modeInfo?.identifier),
    modeIcon: cleanString(stop.modeInfo?.remoteIcon || stop.modeInfo?.localIcon),
    modeLabel: cleanString(stop.modeInfo?.alt),
    stopType: cleanString(stop.stopType),
    services: [...new Set(services)],
    operators
  };
}

function inferPlatform(stopCode) {
  const parts = stopCode.split(':');
  return parts.length >= 5 ? parts.at(-1) : '';
}

function decodePolyline(encoded, precision = 5) {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const factor = 10 ** precision;
  while (index < encoded.length) {
    const latitudeValue = decodeValue(encoded, index);
    if (!latitudeValue) break;
    index = latitudeValue.index;
    const longitudeValue = decodeValue(encoded, index);
    if (!longitudeValue) break;
    index = longitudeValue.index;
    latitude += latitudeValue.value;
    longitude += longitudeValue.value;
    points.push({ latitude: latitude / factor, longitude: longitude / factor });
  }
  return points;
}

function decodeValue(encoded, start) {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte;
  do {
    if (index >= encoded.length) return null;
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { index, value: (result & 1) ? ~(result >> 1) : (result >> 1) };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const currentLatitude = polygon[current].latitude;
    const previousLatitude = polygon[previous].latitude;
    const currentLongitude = longitudeNear(polygon[current].longitude, point.longitude);
    const previousLongitude = longitudeNear(polygon[previous].longitude, point.longitude);
    const intersects = ((currentLatitude > point.latitude) !== (previousLatitude > point.latitude))
      && (point.longitude < ((previousLongitude - currentLongitude)
        * (point.latitude - currentLatitude) / (previousLatitude - currentLatitude)) + currentLongitude);
    if (intersects) inside = !inside;
  }
  return inside;
}

function boundsCenter(bounds) {
  const latitude = bounds.reduce((total, box) => total + (box.latMin + box.latMax) / 2, 0) / bounds.length;
  if (bounds.length === 2) {
    const first = (bounds[0].lonMin + bounds[0].lonMax) / 2;
    const second = longitudeNear((bounds[1].lonMin + bounds[1].lonMax) / 2, first);
    return { latitude, longitude: normalizeLongitude((first + second) / 2) };
  }
  return { latitude, longitude: (bounds[0].lonMin + bounds[0].lonMax) / 2 };
}

function pointInBounds(point, bounds) {
  return bounds.some((box) => point.latitude >= box.latMin && point.latitude <= box.latMax
    && point.longitude >= box.lonMin && point.longitude <= box.lonMax);
}

function polygonBoundingArea(polygon, referenceLongitude) {
  const latitudes = polygon.map((point) => point.latitude);
  const longitudes = polygon.map((point) => longitudeNear(point.longitude, referenceLongitude));
  return (Math.max(...latitudes) - Math.min(...latitudes))
    * (Math.max(...longitudes) - Math.min(...longitudes));
}

function longitudeNear(longitude, reference) {
  let value = longitude;
  while (value - reference > 180) value -= 360;
  while (value - reference < -180) value += 360;
  return value;
}

function normalizeLongitude(longitude) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function distanceMetres(left, right) {
  const latitudeRadians = ((left.latitude + right.latitude) / 2) * Math.PI / 180;
  const latitudeMetres = (left.latitude - right.latitude) * 111320;
  const longitudeMetres = (left.longitude - right.longitude) * 111320 * Math.cos(latitudeRadians);
  return Math.hypot(latitudeMetres, longitudeMetres);
}

function normalizeName(name) {
  return name.toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function naturalCompare(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function roundCoordinate(value) {
  return Math.round(value * 1e6) / 1e6;
}

module.exports = {
  cellIDsForBounds,
  decodePolyline,
  normalizeLocationsResponse,
  pointInPolygon,
  resolveRegion
};
