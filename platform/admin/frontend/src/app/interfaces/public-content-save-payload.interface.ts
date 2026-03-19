import { Multimedia } from './multimedia.interface';
import { PublicContentType } from './public-content-type.type';

export interface PublicContentSavePayload {
  contentType: PublicContentType;
  parentContentId: string;
  publicProfileId: string;
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
