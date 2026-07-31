import { TileSetting } from '../interfaces/tile-settings';
import { resolveDefaultTileTitle } from './default-tile-title.util';

describe('resolveDefaultTileTitle', () => {
  it('localizes legacy default labels', () => {
    const imageTile: TileSetting = { id: 'image', type: 'image', label: 'Images', enabled: true, order: 0, custom: false };
    const fileTile: TileSetting = { id: 'file', type: 'custom-file', label: 'Documents', enabled: true, order: 1, custom: false };

    expect(resolveDefaultTileTitle(imageTile, 'Bilder', 'image')).toBe('Bilder');
    expect(resolveDefaultTileTitle(fileTile, 'Dateien', 'custom-file')).toBe('Dateien');
  });

  it('keeps user-defined titles', () => {
    const tile: TileSetting = {
      id: 'custom-image',
      type: 'image',
      label: 'Images',
      enabled: true,
      order: 0,
      custom: true,
      payload: { title: 'Urlaubsfotos' }
    };

    expect(resolveDefaultTileTitle(tile, 'Bilder', 'image')).toBe('Urlaubsfotos');
  });
});
