import {
  decodePolyline,
  insertStopsIntoGeometry,
  snapNearbyGeometryBoundaries
} from './tripgo-route-map.component';

describe('decodePolyline', () => {
  it('decodes a Google encoded polyline', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453]
    ]);
  });
});

describe('insertStopsIntoGeometry', () => {
  it('inserts ordered intermediate stops into the closest line segments', () => {
    const geometry = [
      { latitude: 52.1, longitude: 10.1 },
      { latitude: 52.2, longitude: 10.2 },
      { latitude: 52.3, longitude: 10.3 }
    ];
    const stops = [
      { name: 'Erster Halt', latitude: 52.15, longitude: 10.15 },
      { name: 'Zweiter Halt', latitude: 52.25, longitude: 10.25 }
    ];

    expect(insertStopsIntoGeometry(geometry, stops).map((point) => point.name || '')).toEqual([
      '', 'Erster Halt', '', 'Zweiter Halt', ''
    ]);
  });

  it('keeps an existing geometry point and adds the stop information', () => {
    const geometry = [
      { latitude: 52.1, longitude: 10.1 },
      { latitude: 52.2, longitude: 10.2 },
      { latitude: 52.3, longitude: 10.3 }
    ];

    const merged = insertStopsIntoGeometry(geometry, [
      { name: 'Vorhandener Halt', latitude: 52.2, longitude: 10.2 }
    ]);

    expect(merged.length).toBe(3);
    expect(merged[1].name).toBe('Vorhandener Halt');
  });
});

describe('snapNearbyGeometryBoundaries', () => {
  it('joins consecutive segment geometries when their gap is below ten metres', () => {
    const geometries = snapNearbyGeometryBoundaries([
      [
        { latitude: 52, longitude: 10 },
        { latitude: 52.00005, longitude: 10 }
      ],
      [
        { latitude: 52.0001, longitude: 10 },
        { latitude: 52.001, longitude: 10 }
      ]
    ]);

    expect(geometries[0].at(-1)).toEqual(geometries[1][0]);
  });

  it('keeps larger gaps between consecutive segment geometries', () => {
    const geometries = snapNearbyGeometryBoundaries([
      [{ latitude: 52, longitude: 10 }, { latitude: 52.00005, longitude: 10 }],
      [{ latitude: 52.00025, longitude: 10 }, { latitude: 52.001, longitude: 10 }]
    ]);

    expect(geometries[0].at(-1)).not.toEqual(geometries[1][0]);
  });
});
