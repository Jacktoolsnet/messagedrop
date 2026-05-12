export interface PublicContentReactionProfile {
  publicProfileId: string;
  publicBackendUserId: string | null;
  name: string;
  avatarImage: string;
  defaultStyle: string;
  liked: boolean;
  disliked: boolean;
}

export interface PublicContentReactionState {
  messageUuid: string | null;
  likes: number;
  dislikes: number;
  profiles: PublicContentReactionProfile[];
}
