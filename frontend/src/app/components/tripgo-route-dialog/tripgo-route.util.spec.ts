import { TripGoRouteOption } from '../../interfaces/tripgo';
import {
  tripGoDisplayLocationName,
  tripGoFollowingBoardingPlatform,
  tripGoRouteIcons,
  tripGoServiceLabel,
  tripGoSegmentInstructionLocation
} from './tripgo-route.util';

describe('tripGoFollowingBoardingPlatform', () => {
  const route = {
    id: 'route',
    groupIndex: 0,
    departureTime: '2026-08-06T08:00:00.000Z',
    arrivalTime: '2026-08-06T09:00:00.000Z',
    durationSeconds: 3_600,
    transfers: 0,
    modes: ['wa_wal', 'pt_pub_train'],
    segments: [
      {
        id: 'walk',
        type: 'unscheduled',
        modeIdentifier: 'wa_wal',
        to: { name: 'Wolfenbüttel, Bahnhof' },
        geometry: []
      },
      {
        id: 'transfer',
        type: 'stationary',
        modeLabel: 'Transfer',
        from: { name: 'Wolfenbüttel, Bahnhof' },
        geometry: []
      },
      {
        id: 'train',
        type: 'scheduled',
        modeIdentifier: 'pt_pub_train',
        modeLabel: 'Zug',
        from: { name: 'Wolfenbüttel, Bahnhof' },
        service: { number: 'RB 45', startPlatform: 'A' },
        geometry: []
      }
    ]
  } satisfies TripGoRouteOption;

  it('makes the next boarding platform available to a preceding walk', () => {
    expect(tripGoFollowingBoardingPlatform(route, 0)).toBe('A');
  });

  it('makes the next boarding platform available to a transfer', () => {
    expect(tripGoFollowingBoardingPlatform(route, 1)).toBe('A');
  });

  it('does not add a following platform to the scheduled segment itself', () => {
    expect(tripGoFollowingBoardingPlatform(route, 2)).toBeUndefined();
  });

  it('uses the next starting point as walking destination', () => {
    expect(tripGoSegmentInstructionLocation(route, 0)).toBe('Bahnhof Wolfenbüttel');
  });

  it('uses the next starting point as waiting location', () => {
    expect(tripGoSegmentInstructionLocation(route, 1)).toBe('Bahnhof Wolfenbüttel');
  });

  it('combines transport mode and service number', () => {
    expect(tripGoServiceLabel(route.segments[2])).toBe('Zug RB 45');
  });

  it('returns every used transport icon once and in route order', () => {
    expect(tripGoRouteIcons(route)).toEqual(['directions_walk', 'train']);
  });

  it('formats station names for route instructions', () => {
    expect(tripGoDisplayLocationName('Wolfenbüttel, Bahnhof')).toBe('Bahnhof Wolfenbüttel');
  });
});
