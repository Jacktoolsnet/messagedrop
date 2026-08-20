import { Location } from '../interfaces/location';
import { Multimedia } from '../interfaces/multimedia';
import { MultimediaType } from '../interfaces/multimedia-type';

export function createLocationMultimedia(location: Location): Multimedia {
  return {
    type: MultimediaType.LOCATION,
    location: { ...location },
    url: '',
    contentId: '',
    sourceUrl: '',
    attribution: '',
    title: '',
    description: ''
  };
}

export function getMultimediaLocation(multimedia?: Multimedia | null): Location | null {
  if (multimedia?.type !== MultimediaType.LOCATION || !multimedia.location) {
    return null;
  }

  const latitude = Number(multimedia.location.latitude);
  const longitude = Number(multimedia.location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    ...multimedia.location,
    latitude,
    longitude
  };
}
