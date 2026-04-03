export interface StickerPack {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  name: string;
  slug: string;
  previewStickerId: string | null;
  licenseNote: string;
  licenseFilePath: string;
  licenseFileName: string;
  licenseFileMimeType: string;
  searchVisible: boolean;
  status: string;
  sortOrder: number;
  stickerCount: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
