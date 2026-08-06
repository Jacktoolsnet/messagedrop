import { TripGoRouteOption, TripGoRouteSegment } from '../../interfaces/tripgo';

export function tripGoSegmentIcon(segment: TripGoRouteSegment): string {
  const identifier = `${segment.modeIdentifier || ''} ${segment.icon || ''}`.toLowerCase();
  if (identifier.startsWith('wa_') || identifier.includes('walk')) return 'directions_walk';
  if (identifier.includes('flight') || identifier.includes('plane') || identifier.includes('_air')) return 'flight';
  if (identifier.includes('bus')) return 'directions_bus';
  if (identifier.includes('tram')) return 'tram';
  if (identifier.includes('train') || identifier.includes('subway') || identifier.includes('rail') || identifier.includes('metro')) return 'train';
  if (segment.type === 'stationary') return 'schedule';
  return 'directions_transit';
}

/**
 * TripGo assigns the platform to the scheduled segment. For an approach on foot
 * and a stationary transfer immediately before it, that platform is nevertheless
 * useful already, so expose it to those preceding instructions as well.
 */
export function tripGoFollowingBoardingPlatform(
  route: TripGoRouteOption,
  segmentIndex: number
): string | undefined {
  const segment = route.segments[segmentIndex];
  if (!segment || (tripGoSegmentIcon(segment) !== 'directions_walk' && segment.type !== 'stationary')) {
    return undefined;
  }

  for (let index = segmentIndex + 1; index < route.segments.length; index += 1) {
    const followingSegment = route.segments[index];
    if (followingSegment.service?.startPlatform) return followingSegment.service.startPlatform;
    if (followingSegment.type === 'scheduled') return undefined;
  }
  return undefined;
}

export function tripGoSegmentInstructionLocation(
  route: TripGoRouteOption,
  segmentIndex: number
): string | undefined {
  const segment = route.segments[segmentIndex];
  if (!segment || (tripGoSegmentIcon(segment) !== 'directions_walk' && segment.type !== 'stationary')) {
    return undefined;
  }

  const followingScheduledSegment = route.segments
    .slice(segmentIndex + 1)
    .find((candidate) => candidate.type === 'scheduled');
  const name = segment.type === 'stationary'
    ? followingScheduledSegment?.from?.name || segment.from?.name || segment.to?.name
    : segment.to?.name || followingScheduledSegment?.from?.name;
  return formatTripGoLocationName(name);
}

function formatTripGoLocationName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const stationName = name.match(/^(.+),\s*((?:Haupt)?bahnhof)$/i);
  return stationName ? `${stationName[2]} ${stationName[1]}` : name;
}
