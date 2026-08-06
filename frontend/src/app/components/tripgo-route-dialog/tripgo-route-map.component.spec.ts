import { decodePolyline } from './tripgo-route-map.component';

describe('decodePolyline', () => {
  it('decodes a Google encoded polyline', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453]
    ]);
  });
});
