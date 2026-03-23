import { Multimedia } from './multimedia.interface';
import { PublicContentType } from './public-content-type.type';

export interface ExternalPublicContent {
  uuid: string;
  parentUuid: string;
  userId: string;
  contentType: PublicContentType;
  displayName: string;
  avatarImage: string;
  style: string;
  message: string;
  hashtags: string[];
  multimedia: Multimedia;
  commentsNumber: number;
  status: string;
  createdAt: number;
  publicProfileId: string | null;
}
