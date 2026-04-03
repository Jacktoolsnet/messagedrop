import { StickerSourceMetadata } from './sticker-source-metadata.interface';

export interface StickerPack {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  name: string;
  slug: string;
  previewStickerId: string | null;
  sourceProvider: string;
  sourceReference: string;
  sourceMetadata: StickerSourceMetadata | null;
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
