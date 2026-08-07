function normalizeDeparturesResponse(data, region) {
  const embarkationStops = Array.isArray(data?.embarkationStops) ? data.embarkationStops : [];
  const normalizedDepartures = embarkationStops.flatMap((stop) => {
    const stopCode = text(stop?.stopCode);
    return (Array.isArray(stop?.services) ? stop.services : [])
      .map((service, index) => normalizeDeparture(service, stopCode, region, index))
      .filter(Boolean);
  });

  const departures = [...new Map(normalizedDepartures.map((departure) => [
    departureIdentity(departure), departure
  ])).values()];

  departures.sort((left, right) => Date.parse(left.departureTime) - Date.parse(right.departureTime));
  return {
    region,
    updatedAt: new Date().toISOString(),
    departures,
    alerts: normalizeAlerts(data?.alerts)
  };
}

function departureIdentity(departure) {
  if (!departure.serviceTripId) return departure.id;
  return [departure.serviceTripId, departure.scheduledDepartureTime || departure.departureTime,
    departure.line, departure.direction].join('|');
}

function normalizeDeparture(service, stopCode, region, index) {
  if (!service || typeof service !== 'object') return null;
  const scheduledEpoch = epoch(service.startTime);
  const realTimeEpoch = epoch(service.realTimeDeparture);
  const departureEpoch = realTimeEpoch || scheduledEpoch;
  if (!departureEpoch) return null;
  const status = text(service.realTimeStatus);
  const cancelled = service.isCancelled === true || status === 'CANCELLED';
  const serviceTripId = text(service.serviceTripID);
  const routeId = text(service.routeID);
  return {
    id: [stopCode, serviceTripId || routeId || index, scheduledEpoch || departureEpoch].join(':'),
    region,
    stopCode,
    serviceTripId: serviceTripId || undefined,
    routeId: routeId || undefined,
    operator: text(service.operator) || undefined,
    operatorId: text(service.operatorID) || undefined,
    line: normalizedServiceNumber(service),
    serviceName: text(service.serviceName) || undefined,
    direction: text(service.serviceDirection) || undefined,
    modeIdentifier: text(service.modeInfo?.identifier) || undefined,
    modeLabel: normalizedModeLabel(service),
    icon: text(service.modeInfo?.localIcon) || undefined,
    color: normalizeColor(service.serviceColor),
    textColor: normalizeColor(service.serviceTextColor),
    scheduledDepartureTime: iso(scheduledEpoch),
    departureTime: iso(departureEpoch),
    delaySeconds: scheduledEpoch && realTimeEpoch ? realTimeEpoch - scheduledEpoch : undefined,
    platform: text(service.startPlatform) || undefined,
    scheduledPlatform: text(service.timetableStartPlatform) || undefined,
    realTime: status === 'IS_REAL_TIME' || Boolean(realTimeEpoch),
    realTimeStatus: status || undefined,
    cancelled,
    wheelchairAccessible: optionalBoolean(service.wheelchairAccessible),
    bicycleAccessible: optionalBoolean(service.bicycleAccessible),
    alerts: normalizeAlerts(service.alerts)
  };
}

function normalizedModeLabel(service) {
  const fallback = text(service.modeInfo?.alt) || undefined;
  if (!isGermanRailService(service)) return fallback;
  switch (extendedGtfsRouteType(service)) {
    case 101:
      return isDbLongDistance(service) ? 'ICE' : fallback;
    case 102:
      return isDbLongDistance(service) ? 'IC/EC' : fallback;
    case 109:
      return 'S-Bahn';
    default:
      return /train-germany-s/i.test(text(service.modeInfo?.remoteIcon)) ? 'S-Bahn' : fallback;
  }
}

function normalizedServiceNumber(service) {
  const fallback = text(service.serviceNumber) || text(service.serviceShortName)
    || text(service.serviceName) || undefined;
  const routeType = extendedGtfsRouteType(service);
  if ((routeType !== 101 && routeType !== 102) || !isDbLongDistance(service)) return fallback;
  const shortName = text(service.serviceShortName);
  if (!shortName || !/^\d+$/.test(shortName)) return fallback;
  return shortName.replace(/^0+(?=\d)/, '');
}

function extendedGtfsRouteType(service) {
  const routeId = text(service.routeID || service.routeId || service.externalData?.routeId);
  const match = routeId.match(/_(\d{3})$/);
  return match ? Number(match[1]) : null;
}

function isGermanRailService(service) {
  const identifier = text(service.modeInfo?.identifier).toLowerCase();
  const operator = text(service.operator || service.externalData?.operatorName).toLowerCase();
  return identifier.includes('train') && (/train-germany-/i.test(text(service.modeInfo?.remoteIcon))
    || operator.includes('db fernverkehr') || operator.includes('s-bahn'));
}

function isDbLongDistance(service) {
  return text(service.operator || service.externalData?.operatorName).toLowerCase().includes('db fernverkehr');
}

function normalizeAlerts(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((alert) => text(alert?.title) || text(alert?.text) || text(alert?.description))
    .filter(Boolean))];
}

function normalizeColor(value) {
  if (typeof value === 'string') {
    const color = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`;
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const red = channel(value.red ?? value.r);
  const green = channel(value.green ?? value.g);
  const blue = channel(value.blue ?? value.b);
  if (red === null || green === null || blue === null) return undefined;
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

function channel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(255, Math.round(number)));
}

function hex(value) {
  return value.toString(16).padStart(2, '0');
}

function epoch(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function iso(value) {
  return value ? new Date(value * 1000).toISOString() : undefined;
}

function text(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function optionalBoolean(value) {
  return typeof value === 'boolean' ? value : undefined;
}

module.exports = { normalizeDeparturesResponse };
