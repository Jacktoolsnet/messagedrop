import { TileSetting } from '../interfaces/tile-settings';
import { resolveDefaultTileTitle } from './default-tile-title.util';

describe('resolveDefaultTileTitle', () => {
  it('localizes legacy default labels', () => {
    const imageTile = { type: 'image', label: 'Images', custom: false } as TileSetting;
    const fileTile = { type: 'custom-file', label: 'Documents', custom: false } as TileSetting;

    expect(resolveDefaultTileTitle(imageTile, 'Bilder', 'image')).toBe('Bilder');
    expect(resolveDefaultTileTitle(fileTile, 'Dateien', 'custom-file')).toBe('Dateien');
  });

  it('keeps user-defined titles', () => {
    const tile = {
      type: 'image',
      label: 'Images',
      custom: true,
      payload: { title: 'Urlaubsfotos' }
    } as TileSetting;

    expect(resolveDefaultTileTitle(tile, 'Bilder', 'image')).toBe('Urlaubsfotos');
  });
});
