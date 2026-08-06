import { TripGoRouteOption } from '../../interfaces/tripgo';
import { tripGoFollowingBoardingPlatform } from './tripgo-route.util';

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
      { id: 'walk', type: 'unscheduled', modeIdentifier: 'wa_wal', geometry: [] },
      { id: 'transfer', type: 'stationary', modeLabel: 'Transfer', geometry: [] },
      {
        id: 'train',
        type: 'scheduled',
        modeIdentifier: 'pt_pub_train',
        service: { startPlatform: 'A' },
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
});
