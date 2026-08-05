function normalizeRoutingResponse(payload, { maxRoutes = 12, routesPerGroup = 2 } = {}) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.groups)
      || !Array.isArray(payload.segmentTemplates)) {
    const error = new Error('invalid_tripgo_routing_response');
    error.status = 502;
    throw error;
  }

  const templates = new Map(payload.segmentTemplates.map((template) => [template.hashCode, template]));
  const candidates = payload.groups.flatMap((group, groupIndex) => (group.trips || []).map((trip) => ({
    groupIndex,
    frequencyMinutes: finiteNumber(group.frequency),
    trip
  })));
  const selected = selectTrips(candidates, positiveInteger(maxRoutes, 12), positiveInteger(routesPerGroup, 2));

  return {
    region: stringOrNull(payload.region),
    query: normalizeQuery(payload.query),
    routes: selected.map((candidate) => normalizeTrip(candidate, templates)),
    meta: {
      groups: payload.groups.length,
      totalRoutes: candidates.length,
      returnedRoutes: selected.length
    }
  };
}

function selectTrips(candidates, maxRoutes, routesPerGroup) {
  const queryTime = candidates.find(({ trip }) => Number.isFinite(trip?.queryTime))?.trip.queryTime;
  const eligible = candidates.filter(({ trip }) => trip && Number.isFinite(trip.depart) && Number.isFinite(trip.arrive)
    && (!Number.isFinite(queryTime) || trip.arrive >= queryTime));
  const sorted = [...eligible].sort(compareCandidates);
  const selected = [];
  const selectedIds = new Set();
  const perGroup = new Map();

  for (const candidate of sorted) {
    const count = perGroup.get(candidate.groupIndex) || 0;
    if (count >= routesPerGroup) continue;
    selected.push(candidate);
    selectedIds.add(candidate.trip.id);
    perGroup.set(candidate.groupIndex, count + 1);
    if (selected.length >= maxRoutes) return selected.sort(compareCandidates);
  }
  for (const candidate of sorted) {
    if (selectedIds.has(candidate.trip.id)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.trip.id);
    if (selected.length >= maxRoutes) break;
  }
  return selected.sort(compareCandidates);
}

function compareCandidates(left, right) {
  const leftScore = finiteNumber(left.trip.weightedScore) ?? Number.POSITIVE_INFINITY;
  const rightScore = finiteNumber(right.trip.weightedScore) ?? Number.POSITIVE_INFINITY;
  return leftScore - rightScore || left.trip.depart - right.trip.depart;
}

function normalizeTrip(candidate, templates) {
  const trip = candidate.trip;
  const segments = (trip.segments || []).map((reference) => {
    const template = templates.get(reference.segmentTemplateHashCode);
    if (!template) {
      const error = new Error('missing_tripgo_segment_template');
      error.status = 502;
      throw error;
    }
    return normalizeSegment(reference, template);
  });
  const scheduledCount = segments.filter((segment) => segment.type === 'scheduled').length;
  return compact({
    id: String(trip.id),
    groupIndex: candidate.groupIndex,
    frequencyMinutes: candidate.frequencyMinutes,
    departureTime: epochIso(trip.depart),
    arrivalTime: epochIso(trip.arrive),
    durationSeconds: durationSeconds(trip.depart, trip.arrive),
    availability: stringOrNull(trip.availability),
    weightedScore: finiteNumber(trip.weightedScore),
    calories: finiteNumber(trip.caloriesCost),
    carbon: finiteNumber(trip.carbonCost),
    transfers: Math.max(0, scheduledCount - 1),
    modes: [...new Set(segments
      .filter((segment) => segment.type !== 'stationary')
      .map((segment) => segment.modeIdentifier)
      .filter(Boolean))],
    cost: totalCost(segments),
    segments
  });
}

function normalizeSegment(reference, template) {
  const modeInfo = template.modeInfo || {};
  const location = normalizeLocation(template.location);
  const travelledShapes = (template.shapes || []).filter((shape) => shape.travelled !== false);
  const shapes = travelledShapes.length > 0 ? travelledShapes : (template.shapes || []);
  const geometry = [
    ...shapes.map((shape) => shape.encodedWaypoints),
    ...(template.streets || []).map((street) => street.encodedWaypoints)
  ].filter((value) => typeof value === 'string' && value.length > 0);

  return compact({
    id: String(reference.id),
    type: stringOrNull(template.type),
    modeIdentifier: stringOrNull(modeInfo.identifier || template.modeIdentifier),
    modeLabel: stringOrNull(modeInfo.alt),
    icon: stringOrNull(modeInfo.localIcon),
    color: rgbHex(reference.serviceColor || modeInfo.color),
    startTime: epochIso(reference.startTime),
    endTime: epochIso(reference.endTime),
    durationSeconds: durationSeconds(reference.startTime, reference.endTime),
    availability: stringOrNull(reference.availability),
    bicycleAccessible: typeof reference.bicycleAccessible === 'boolean' ? reference.bicycleAccessible : null,
    from: normalizeLocation(template.from) || location,
    to: normalizeLocation(template.to) || location,
    distanceMeters: finiteNumber(template.metres),
    cost: normalizeCost(template.localCost),
    service: normalizeService(reference, template),
    geometry
  });
}

function normalizeService(reference, template) {
  if (template.type !== 'scheduled') return null;
  return compact({
    number: stringOrNull(reference.serviceNumber || reference.serviceShortName || reference.serviceName),
    direction: stringOrNull(reference.serviceDirection),
    operator: stringOrNull(template.serviceOperator || template.operator || reference.externalData?.operatorName),
    startPlatform: stringOrNull(reference.startPlatform || reference.platform),
    endPlatform: stringOrNull(reference.endPlatform),
    stops: finiteNumber(reference.stops),
    routeId: stringOrNull(reference.routeID || reference.routeId),
    tripId: stringOrNull(reference.serviceTripID),
    textColor: rgbHex(reference.serviceTextColor)
  });
}

function normalizeLocation(value) {
  if (!value || typeof value !== 'object') return null;
  return compact({
    name: stringOrNull(value.name || value.address),
    address: stringOrNull(value.address),
    latitude: finiteNumber(value.lat),
    longitude: finiteNumber(value.lng),
    stopCode: stringOrNull(value.stopCode || value.code),
    region: stringOrNull(value.region),
    timezone: stringOrNull(value.timezone)
  });
}

function normalizeQuery(query) {
  if (!query || typeof query !== 'object') return null;
  return compact({
    departureTime: dateIso(query.depart),
    arrivalTime: dateIso(query.arrive),
    from: normalizeLocation(query.from),
    to: normalizeLocation(query.to)
  });
}

function normalizeCost(value) {
  const amount = finiteNumber(value?.cost);
  const currency = stringOrNull(value?.currency);
  return amount === null || !currency ? null : compact({
    amount,
    currency,
    accuracy: stringOrNull(value.accuracy)
  });
}

function totalCost(segments) {
  const costs = segments.map((segment) => segment.cost).filter(Boolean);
  if (costs.length === 0) return null;
  const currencies = new Set(costs.map((cost) => cost.currency));
  if (currencies.size !== 1) return null;
  return { amount: costs.reduce((sum, cost) => sum + cost.amount, 0), currency: costs[0].currency };
}

function rgbHex(value) {
  if (!value || typeof value !== 'object') return null;
  const components = [value.red, value.green, value.blue];
  if (components.some((component) => !Number.isInteger(component) || component < 0 || component > 255)) return null;
  return `#${components.map((component) => component.toString(16).padStart(2, '0')).join('')}`;
}

function epochIso(value) {
  return Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function durationSeconds(start, end) {
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
}

function dateIso(value) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined));
}

module.exports = { normalizeRoutingResponse, selectTrips, rgbHex };
