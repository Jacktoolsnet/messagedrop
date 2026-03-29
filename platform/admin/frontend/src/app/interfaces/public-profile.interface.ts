import { PublicProfileAvatarAttribution } from './public-profile-avatar-attribution.interface';

export interface PublicProfileSummary {
  id: string;
  name: string;
  avatarImage: string;
  avatarAttribution: PublicProfileAvatarAttribution | null;
  defaultStyle: string;
  aiGuidance: string;
}

export interface PublicProfile extends PublicProfileSummary {
  publicBackendUserId: string | null;
  contentCount: number;
  createdAt: number;
  updatedAt: number;
}
