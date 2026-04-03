export interface StickerCategory {
  id: string;
  name: string;
  slug: string;
  previewStickerId: string | null;
  status: string;
  sortOrder: number;
  packCount: number;
  stickerCount: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
