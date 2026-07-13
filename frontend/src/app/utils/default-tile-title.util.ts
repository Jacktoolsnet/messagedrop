import { TileSetting } from '../interfaces/tile-settings';

const DEFAULT_TITLES: Record<'image' | 'custom-file', ReadonlySet<string>> = {
  image: new Set(['Images', 'Bilder', 'Imágenes']),
  'custom-file': new Set(['Documents', 'Dateien', 'Archivos', 'Fichiers'])
};

export function resolveDefaultTileTitle(
  tile: TileSetting | null | undefined,
  fallback: string,
  type: 'image' | 'custom-file'
): string {
  const title = tile?.payload?.title?.trim() || tile?.label?.trim() || '';
  if (!title || (!tile?.custom && DEFAULT_TITLES[type].has(title))) {
    return fallback;
  }
  return title;
}
