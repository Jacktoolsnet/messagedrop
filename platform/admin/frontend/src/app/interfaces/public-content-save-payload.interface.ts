import { Multimedia } from './multimedia.interface';

export interface PublicContentSavePayload {
  message: string;
  location: {
    latitude: number;
    longitude: number;
    plusCode: string;
    label: string;
  };
  markerType: string;
  style: string;
  hashtags: string[];
  multimedia: Multimedia;
}
