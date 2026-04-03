export interface Sticker {
  id: string;
  packId: string;
  packName: string;
  packSlug: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  name: string;
  slug: string;
  keywords: string[];
  previewPath: string;
  previewMimeType: string;
  chatPath: string;
  chatMimeType: string;
  originalPath: string;
  originalMimeType: string;
  width: number | null;
  height: number | null;
  searchVisible: boolean;
  status: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
