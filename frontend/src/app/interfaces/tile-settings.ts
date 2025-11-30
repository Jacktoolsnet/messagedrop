export type DefaultTileType = 'datetime' | 'weather' | 'airQuality' | 'note' | 'message' | 'image';
export type TileType = DefaultTileType | `custom-${string}`;

export interface TileSetting {
  id: string;
  type: TileType;
  label: string;
  enabled: boolean;
  order: number;
  custom?: boolean;
  payload?: {
    title?: string;
    text?: string;
    icon?: string;
    url?: string;
    linkType?: 'web' | 'phone' | 'email' | 'whatsapp' | 'sms' | 'map';
    date?: string;
    migraine?: {
      tempWarn1: number;
      tempWarn2: number;
      pressureWarn1: number;
      pressureWarn2: number;
    };
  };
}

export const tileTypeToLabel: Record<DefaultTileType, string> = {
  datetime: 'Date & Time',
  weather: 'Weather',
  airQuality: 'Air quality',
  note: 'Notes',
  message: 'Messages',
  image: 'Images'
};

const tileTypeOrder: DefaultTileType[] = ['datetime', 'weather', 'airQuality', 'note', 'message', 'image'];

export function createDefaultTileSettings(): TileSetting[] {
  return tileTypeOrder.map((type, index) => {
    return {
      id: `default-${type}`,
      type,
      label: tileTypeToLabel[type],
      enabled: true,
      order: index
    };
  });
}

export function normalizeTileSettings(tileSettings: TileSetting[] | undefined): TileSetting[] {
  const defaults = createDefaultTileSettings();
  const incoming = tileSettings ?? [];

  const defaultsNormalized = defaults.map(defaultSetting => {
    const current = incoming.find(setting => setting.type === defaultSetting.type && !setting.custom);
    return {
      ...defaultSetting,
      id: current?.id ?? defaultSetting.id,
      payload: current?.payload ?? defaultSetting.payload,
      enabled: current?.enabled ?? defaultSetting.enabled,
      order: current?.order ?? defaultSetting.order
    };
  });

  const customTiles = incoming
    .filter(setting => setting.custom || setting.type.startsWith('custom-'))
    .map((setting, index) => ({
      ...setting,
      id: setting.id ?? `custom-${setting.type}-${index}`,
      custom: true,
      payload: setting.payload,
      order: setting.order ?? defaultsNormalized.length + index
    }));

  return [...defaultsNormalized, ...customTiles]
    .sort((a, b) => a.order - b.order)
    .map((setting, index) => ({ ...setting, order: index }));
}
