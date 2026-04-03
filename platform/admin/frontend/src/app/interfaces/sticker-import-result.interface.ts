import { Sticker } from './sticker.interface';

export interface StickerImportResult {
  status: number;
  createdCount: number;
  updatedCount: number;
  rows: Sticker[];
}
