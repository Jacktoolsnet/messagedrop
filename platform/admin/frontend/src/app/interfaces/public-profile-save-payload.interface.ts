import { PublicProfileAvatarAttribution } from './public-profile-avatar-attribution.interface';

export interface PublicProfileSavePayload {
  name: string;
  avatarImage: string;
  avatarAttribution: PublicProfileAvatarAttribution | null;
  defaultStyle: string;
  aiGuidance: string;
}
