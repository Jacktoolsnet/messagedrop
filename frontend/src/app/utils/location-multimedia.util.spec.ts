import { MultimediaType } from '../interfaces/multimedia-type';
import { createLocationMultimedia, getMultimediaLocation } from './location-multimedia.util';

describe('location multimedia', () => {
  it('creates an independent multimedia attachment from a location', () => {
    const location = { latitude: 52.52, longitude: 13.405, plusCode: '9F4MGC9C+X2' };

    const multimedia = createLocationMultimedia(location);
    location.latitude = 0;

    expect(multimedia.type).toBe(MultimediaType.LOCATION);
    expect(multimedia.location?.latitude).toBe(52.52);
    expect(getMultimediaLocation(multimedia)).toEqual({
      latitude: 52.52,
      longitude: 13.405,
      plusCode: '9F4MGC9C+X2'
    });
  });

  it('rejects invalid coordinates', () => {
    const multimedia = createLocationMultimedia({
      latitude: 100,
      longitude: 13.405,
      plusCode: ''
    });

    expect(getMultimediaLocation(multimedia)).toBeNull();
  });
});
