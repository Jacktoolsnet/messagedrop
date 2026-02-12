import { TileSetting } from './tile-settings';

export interface ExperienceTileContext {
  productCode: string;
  title?: string;
  imageUrl?: string;
  hashtags?: string[];
  tileSettings?: TileSetting[];
}
