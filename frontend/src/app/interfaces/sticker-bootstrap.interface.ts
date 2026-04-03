import { StickerCategory } from './sticker-category.interface';
import { StickerPack } from './sticker-pack.interface';
import { Sticker } from './sticker.interface';

export interface StickerBootstrapPack extends StickerPack {
  stickers: Sticker[];
}

export interface StickerBootstrapCategory extends StickerCategory {
  packs: StickerBootstrapPack[];
}
