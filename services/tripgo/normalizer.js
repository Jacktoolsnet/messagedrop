function normalizeRoutingResponse(payload, { maxRoutes = 12, routesPerGroup = 2 } = {}) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.groups)) {
    const error = new Error('invalid_tripgo_routing_response');
    error.status = 502;
    throw error;
  }

  const hasTrips = payload.groups.some((group) => Array.isArray(group.trips) && group.trips.length > 0);
  if (hasTrips && !Array.isArray(payload.segmentTemplates)) {
    const error = new Error('invalid_tripgo_routing_response');
    error.status = 502;
    throw error;
  }

  // TripGo omits segmentTemplates entirely when no route was found. This is a
  // valid empty routing result rather than a malformed upstream response.
  const segmentTemplates = Array.isArray(payload.segmentTemplates) ? payload.segmentTemplates : [];
  const templates = new Map(segmentTemplates.map((template) => [template.hashCode, template]));
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

function normalizeServiceResponse(payload, query = {}) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('invalid_tripgo_service_response');
    error.status = 502;
    throw error;
  }
  const objects = nestedObjects(payload, 7, 1500);
  const service = objects.find((value) => value.serviceTripID === query.serviceTripId)
    || objects.find((value) => value.serviceTripId === query.serviceTripId)
    || objects.find((value) => hasAny(value, ['startTime', 'endTime']) && hasAny(value, ['serviceNumber', 'serviceDirection', 'realTime']))
    || payload;
  const departureTime = flexibleIso(firstValue(service, ['startTime', 'departureTime', 'departure']));
  const arrivalTime = flexibleIso(firstValue(service, ['endTime', 'arrivalTime', 'arrival']));
  const scheduledDepartureTime = flexibleIso(firstValue(service, [
    'timetableStartTime', 'scheduledStartTime', 'scheduledDepartureTime', 'plannedDepartureTime'
  ]));
  const scheduledArrivalTime = flexibleIso(firstValue(service, [
    'timetableEndTime', 'scheduledEndTime', 'scheduledArrivalTime', 'plannedArrivalTime'
  ]));
  const explicitDelay = finiteNumber(firstValue(service, ['departureDelay', 'delaySeconds', 'delay']));
  const calculatedDelay = departureTime && scheduledDepartureTime
    ? Math.round((Date.parse(departureTime) - Date.parse(scheduledDepartureTime)) / 1000)
    : null;
  const shapes = Array.isArray(payload.shapes) ? payload.shapes : [];
  const travelledShapes = shapes.filter((shape) => shape?.travelled !== false);
  const relevantShapes = travelledShapes.length > 0 ? travelledShapes : shapes;
  return compact({
    serviceTripId: stringOrNull(service.serviceTripID || service.serviceTripId || query.serviceTripId),
    updatedAt: new Date().toISOString(),
    departureTime,
    arrivalTime,
    scheduledDepartureTime,
    scheduledArrivalTime,
    delaySeconds: explicitDelay ?? calculatedDelay,
    platform: stringOrNull(firstValue(service, ['startPlatform', 'platform'])),
    endPlatform: stringOrNull(service.endPlatform),
    direction: stringOrNull(service.serviceDirection || service.direction),
    realTime: service.realTime === true || service.isRealTime === true
      || (/REAL_TIME/i.test(String(service.realTimeStatus || ''))
        && !/NOT_REAL_TIME/i.test(String(service.realTimeStatus || ''))),
    alerts: normalizeAlerts(payload, service),
    stops: uniqueBy(relevantShapes.flatMap((shape) => shape.stops || []).map(normalizeServiceStop), stopKey),
    geometry: uniqueConsecutive(relevantShapes
      .flatMap((shape) => shape.waypoints || [])
      .map(normalizeServiceWaypoint)
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)))
  });
}

function normalizeLatestResponse(payload, query = {}) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.services)) {
    const error = new Error('invalid_tripgo_latest_response');
    error.status = 502;
    throw error;
  }
  const service = payload.services.find((value) => value?.serviceTripID === query.serviceTripId)
    || payload.services[0]
    || {};
  const departureTime = flexibleIso(service.startTime);
  const arrivalTime = flexibleIso(service.endTime);
  const scheduledDepartureTime = flexibleIso(query.embarkationTime);
  const delaySeconds = departureTime && scheduledDepartureTime
    ? Math.round((Date.parse(departureTime) - Date.parse(scheduledDepartureTime)) / 1000)
    : null;
  const stops = Array.isArray(service.stops) ? service.stops.map(normalizeLatestStop) : [];
  const vehicle = normalizeRealtimeVehicle(service.realtimeVehicle);
  const cancelled = service.isCancelled === true || service.realTimeStatus === 'CANCELLED';
  const hasPrediction = Boolean(departureTime || arrivalTime || stops.length > 0 || vehicle || cancelled);

  return compact({
    serviceTripId: stringOrNull(service.serviceTripID || query.serviceTripId),
    updatedAt: flexibleIso(service.lastUpdate) || vehicle?.updatedAt || new Date().toISOString(),
    departureTime,
    arrivalTime,
    scheduledDepartureTime,
    delaySeconds,
    realTime: hasPrediction,
    cancelled,
    alerts: normalizeAlerts(payload, service),
    stops,
    vehicle
  });
}

function normalizeLatestStop(value) {
  return compact({
    stopCode: stringOrNull(value?.stopCode || value?.code),
    arrivalTime: flexibleIso(value?.arrival || value?.predictedArrival || value?.actualArrival),
    departureTime: flexibleIso(value?.departure || value?.predictedDeparture || value?.actualDeparture),
    actualArrivalTime: flexibleIso(value?.actualArrival),
    actualDepartureTime: flexibleIso(value?.actualDeparture),
    updatedAt: flexibleIso(value?.lastUpdate)
  });
}

function normalizeRealtimeVehicle(value) {
  if (!value || typeof value !== 'object' || !value.location) return null;
  const latitude = finiteNumber(value.location.lat);
  const longitude = finiteNumber(value.location.lng);
  if (latitude === null || longitude === null) return null;
  return compact({
    id: stringOrNull(value.id),
    latitude,
    longitude,
    bearing: finiteNumber(value.location.bearing),
    speedMetersPerSecond: finiteNumber(value.location.speed),
    updatedAt: flexibleIso(value.lastUpdate)
  });
}

function normalizeServiceStop(value) {
  return compact({
    name: stringOrNull(value?.name),
    stopCode: stringOrNull(value?.stopCode || value?.code),
    latitude: finiteNumber(value?.lat),
    longitude: finiteNumber(value?.lng),
    arrivalTime: flexibleIso(value?.arrival),
    departureTime: flexibleIso(value?.departure),
    pickUpOnly: typeof value?.pickUpOnly === 'boolean' ? value.pickUpOnly : null,
    dropOffOnly: typeof value?.dropOffOnly === 'boolean' ? value.dropOffOnly : null
  });
}

function normalizeServiceWaypoint(value) {
  return compact({
    latitude: finiteNumber(value?.lat),
    longitude: finiteNumber(value?.lng)
  });
}

function uniqueBy(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const identifier = key(value);
    if (!identifier || seen.has(identifier)) return false;
    seen.add(identifier);
    return true;
  });
}

function uniqueConsecutive(values) {
  return values.filter((value, index) => index === 0
    || value.latitude !== values[index - 1].latitude
    || value.longitude !== values[index - 1].longitude);
}

function stopKey(stop) {
  return stop.stopCode || (Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
    ? `${stop.latitude}:${stop.longitude}`
    : stop.name);
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
    modeLabel: normalizedModeLabel(reference, template, modeInfo),
    icon: stringOrNull(modeInfo.localIcon),
    color: rgbHex(reference.serviceColor || modeInfo.color),
    startTime: epochIso(reference.startTime),
    endTime: epochIso(reference.endTime),
    scheduledStartTime: epochIso(reference.timetableStartTime),
    scheduledEndTime: epochIso(reference.timetableEndTime),
    durationSeconds: durationSeconds(reference.startTime, reference.endTime),
    availability: stringOrNull(reference.availability),
    bicycleAccessible: typeof reference.bicycleAccessible === 'boolean' ? reference.bicycleAccessible : null,
    from: normalizeLocation(template.from) || location,
    to: normalizeLocation(template.to) || location,
    distanceMeters: finiteNumber(template.metres),
    cost: normalizeCost(template.localCost),
    service: normalizeService(reference, template),
    turnInstructions: normalizeTurnInstructions(template.streets),
    geometry
  });
}

function normalizeTurnInstructions(streets) {
  if (!Array.isArray(streets)) return null;
  return streets.map((street) => compact({
    action: stringOrNull(street?.instruction),
    streetName: stringOrNull(street?.name),
    distanceMeters: finiteNumber(street?.metres),
    encodedGeometry: stringOrNull(street?.encodedWaypoints)
  })).filter((instruction) => instruction.action || instruction.streetName);
}

function normalizeService(reference, template) {
  if (template.type !== 'scheduled') return null;
  return compact({
    number: normalizedServiceNumber(reference, template),
    direction: stringOrNull(reference.serviceDirection),
    operator: stringOrNull(template.serviceOperator || template.operator || reference.externalData?.operatorName),
    operatorId: stringOrNull(template.operatorID || reference.externalData?.operatorId),
    startPlatform: stringOrNull(reference.startPlatform || reference.platform),
    endPlatform: stringOrNull(reference.endPlatform),
    stops: finiteNumber(reference.stops),
    routeId: stringOrNull(reference.routeID || reference.routeId),
    tripId: stringOrNull(reference.serviceTripID),
    textColor: rgbHex(reference.serviceTextColor),
    realTime: optionalBoolean(reference.realTime, reference.isRealTime, template.realTime, template.isRealTime),
    realTimeStatus: stringOrNull(reference.realTimeStatus),
    realTimeStops: Array.isArray(reference.realtimeStops)
      ? reference.realtimeStops.map(normalizeRouteRealtimeStop)
      : null,
    ticketWebsiteUrl: safeExternalUrl(reference.ticketWebsiteURL)
  });
}

function normalizeRouteRealtimeStop(value) {
  return compact({
    stopCode: stringOrNull(value?.code || value?.stopCode),
    arrivalTime: flexibleIso(value?.predictedArrival || value?.actualArrival),
    departureTime: flexibleIso(value?.predictedDeparture || value?.actualDeparture),
    actualArrivalTime: flexibleIso(value?.actualArrival),
    actualDepartureTime: flexibleIso(value?.actualDeparture)
  });
}

function optionalBoolean(...values) {
  return values.find((value) => typeof value === 'boolean') ?? null;
}

function normalizedModeLabel(reference, template, modeInfo) {
  const fallback = stringOrNull(modeInfo.alt);
  if (!isGermanRailService(reference, template, modeInfo)) return fallback;

  switch (extendedGtfsRouteType(reference)) {
    case 101:
      return isDbLongDistance(reference, template) ? 'ICE' : fallback;
    case 102:
      return isDbLongDistance(reference, template) ? 'IC/EC' : fallback;
    case 109:
      return 'S-Bahn';
    default:
      return /train-germany-s/i.test(String(modeInfo.remoteIcon || '')) ? 'S-Bahn' : fallback;
  }
}

function normalizedServiceNumber(reference, template) {
  const fallback = stringOrNull(reference.serviceNumber || reference.serviceShortName || reference.serviceName);
  const routeType = extendedGtfsRouteType(reference);
  if ((routeType !== 101 && routeType !== 102) || !isDbLongDistance(reference, template)) return fallback;

  const shortName = stringOrNull(reference.serviceShortName);
  if (!shortName || !/^\d+$/.test(shortName)) return fallback;
  return shortName.replace(/^0+(?=\d)/, '');
}

function extendedGtfsRouteType(reference) {
  const routeId = stringOrNull(reference.routeID || reference.routeId || reference.externalData?.routeId);
  const match = routeId?.match(/_(\d{3})$/);
  return match ? Number(match[1]) : null;
}

function isGermanRailService(reference, template, modeInfo) {
  const identifier = String(modeInfo.identifier || template.modeIdentifier || '').toLowerCase();
  const operator = String(template.serviceOperator || template.operator
    || reference.externalData?.operatorName || '').toLowerCase();
  return identifier.includes('train') && (/train-germany-/i.test(String(modeInfo.remoteIcon || ''))
    || operator.includes('db fernverkehr') || operator.includes('s-bahn'));
}

function isDbLongDistance(reference, template) {
  const operator = String(template.serviceOperator || template.operator
    || reference.externalData?.operatorName || '').toLowerCase();
  return operator.includes('db fernverkehr');
}

function safeExternalUrl(value) {
  const candidate = stringOrNull(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
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
  const travelSegments = segments.filter((segment) => segment.type !== 'stationary');
  // A zero-cost walking segment must not make a transit trip look free when
  // TripGo did not provide a fare for the scheduled segment.
  if (travelSegments.length === 0 || travelSegments.some((segment) => !segment.cost)) return null;
  const costs = travelSegments.map((segment) => segment.cost);
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

function flexibleIso(value) {
  if (Number.isFinite(value)) return epochIso(value > 10_000_000_000 ? value / 1000 : value);
  return dateIso(value);
}

function nestedObjects(root, maxDepth, maxObjects) {
  const found = [];
  const visit = (value, depth) => {
    if (!value || typeof value !== 'object' || depth > maxDepth || found.length >= maxObjects) return;
    if (!Array.isArray(value)) found.push(value);
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(root, 0);
  return found;
}

function normalizeAlerts(payload, service) {
  const candidates = [service.alerts, payload.alerts, payload.realtimeAlerts].filter(Array.isArray).flat();
  return [...new Set(candidates.map((alert) => stringOrNull(
    typeof alert === 'string' ? alert : alert?.text || alert?.message || alert?.title || alert?.headerText
  )).filter(Boolean))].slice(0, 10);
}

function firstValue(value, keys) {
  for (const key of keys) if (value?.[key] !== undefined && value[key] !== null) return value[key];
  return null;
}

function hasAny(value, keys) {
  return keys.some((key) => value?.[key] !== undefined);
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

module.exports = {
  normalizeRoutingResponse,
  normalizeServiceResponse,
  normalizeLatestResponse,
  selectTrips,
  rgbHex
};
