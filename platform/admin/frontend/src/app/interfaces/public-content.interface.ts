import { Multimedia } from './multimedia.interface';
import { PublicContentStatus } from './public-content-status.type';
import { PublicContentType } from './public-content-type.type';
import { PublicProfileSummary } from './public-profile.interface';

export interface PublicContentLocation {
  latitude: number;
  longitude: number;
  plusCode: string;
  label: string;
}

export interface PublicContent {
  id: string;
  authorAdminUserId: string;
  authorUsername: string;
  contentType: PublicContentType;
  parentContent: {
    id: string;
    contentType: PublicContentType;
    status: PublicContentStatus;
    message: string;
    locationLabel: string;
    publishedMessageUuid: string | null;
    publicProfileName: string;
  } | null;
  publicProfile: PublicProfileSummary | null;
  childCommentCount: number;
  lastEditorAdminUserId: string | null;
  lastEditorUsername: string | null;
  publisherAdminUserId: string | null;
  publisherUsername: string | null;
  publisherPublicUserId: string | null;
  publishedMessageId: number | null;
  publishedMessageUuid: string | null;
  status: PublicContentStatus;
  message: string;
  location: PublicContentLocation;
  markerType: string;
  style: string;
  hashtags: string[];
  multimedia: Multimedia;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  withdrawnAt: number | null;
  deletedAt: number | null;
}
