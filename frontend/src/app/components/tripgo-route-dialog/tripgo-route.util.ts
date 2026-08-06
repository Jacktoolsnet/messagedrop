import { TripGoRouteSegment } from '../../interfaces/tripgo';

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
