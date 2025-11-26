export type TileType = 'datetime' | 'weather' | 'airQuality' | 'note' | 'message' | 'image';

export interface TileSetting {
  type: TileType;
  label: string;
  enabled: boolean;
  order: number;
}

export const tileTypeToLabel: Record<TileType, string> = {
  datetime: 'Date & Time',
  weather: 'Weather',
  airQuality: 'Air quality',
  note: 'Notes',
  message: 'Messages',
  image: 'Images'
};

const tileTypeOrder: TileType[] = ['datetime', 'weather', 'airQuality', 'note', 'message', 'image'];

export function createDefaultTileSettings(): TileSetting[] {
  return tileTypeOrder.map((type, index) => {
    return {
      type,
      label: tileTypeToLabel[type],
      enabled: true,
      order: index
    };
  });
}

export function normalizeTileSettings(tileSettings: TileSetting[] | undefined): TileSetting[] {
  const defaults = createDefaultTileSettings();
  if (!tileSettings?.length) {
    return defaults;
  }

  const merged = defaults.map(defaultSetting => {
    const current = tileSettings.find(setting => setting.type === defaultSetting.type);
    return {
      ...defaultSetting,
      enabled: current?.enabled ?? defaultSetting.enabled,
      order: current?.order ?? defaultSetting.order
    };
  });

  return merged
    .sort((a, b) => a.order - b.order)
    .map((setting, index) => ({ ...setting, order: index }));
}
