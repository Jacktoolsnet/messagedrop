import { TripGoRouteSegment } from '../../interfaces/tripgo';

export function tripGoSegmentIcon(segment: TripGoRouteSegment): string {
  const identifier = segment.modeIdentifier || '';
  if (identifier.includes('bus')) return 'directions_bus';
  if (identifier.includes('tram')) return 'tram';
  if (identifier.includes('train') || identifier.includes('subway')) return 'train';
  if (identifier.startsWith('wa_')) return 'directions_walk';
  if (segment.type === 'stationary') return 'schedule';
  return 'directions_transit';
}
