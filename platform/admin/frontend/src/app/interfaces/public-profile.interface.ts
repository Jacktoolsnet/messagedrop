export interface PublicProfileSummary {
  id: string;
  name: string;
  avatarImage: string;
  defaultStyle: string;
}

export interface PublicProfile extends PublicProfileSummary {
  publicBackendUserId: string | null;
  contentCount: number;
  createdAt: number;
  updatedAt: number;
}
