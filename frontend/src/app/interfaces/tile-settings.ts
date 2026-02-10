export type DefaultTileType =
  | 'datetime'
  | 'weather'
  | 'airQuality'
  | 'note'
  | 'message'
  | 'hashtags'
  | 'image'
  | 'custom-experience';
export type TileType = DefaultTileType | `custom-${string}`;
export type TileLinkType = 'web' | 'phone' | 'email' | 'whatsapp' | 'sms' | 'map';
export type TileDefaultsContext = 'place' | 'contact';

export interface TileTodoItem {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

export interface TileQuickAction {
  id: string;
  label: string;
  type: TileLinkType;
  value: string;
  icon?: string;
  order: number;
}

export interface TileFileEntry {
  id: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  lastModified?: number;
  addedAt: number;
  order: number;
}

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
    linkType?: TileLinkType;
    date?: string;
    todos?: TileTodoItem[];
    actions?: TileQuickAction[];
    files?: TileFileEntry[];
    migraine?: {
      tempWarn1: number;
      tempWarn2: number;
      pressureWarn1: number;
      pressureWarn2: number;
    };
    pollution?: {
      keys: string[];
      icon?: string;
    };
  };
}

export const tileTypeToLabel: Record<DefaultTileType, string> = {
  datetime: 'Date & Time',
  weather: 'Weather',
  airQuality: 'Air quality',
  note: 'Notes',
  message: 'Messages',
  hashtags: 'Hashtags',
  image: 'Images',
  'custom-experience': 'Experiences'
};

const placeDefaultTileTypeOrder: DefaultTileType[] = [
  'datetime',
  'weather',
  'airQuality',
  'note',
  'message',
  'hashtags',
  'image',
  'custom-experience'
];
const contactDefaultTileTypeOrder: DefaultTileType[] = ['hashtags'];

export function createDefaultTileSettings(context: TileDefaultsContext = 'place'): TileSetting[] {
  const tileTypeOrder = context === 'contact' ? contactDefaultTileTypeOrder : placeDefaultTileTypeOrder;
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

export function normalizeTileSettings(
  tileSettings: TileSetting[] | undefined,
  options?: { includeDefaults?: boolean; includeSystem?: boolean; defaultContext?: TileDefaultsContext }
): TileSetting[] {
  const includeDefaults = options?.includeDefaults ?? true;
  const includeSystem = options?.includeSystem ?? true;
  const defaultContext = options?.defaultContext ?? 'place';
  const defaults = includeDefaults ? createDefaultTileSettings(defaultContext) : [];
  const incoming = tileSettings ?? [];

  const defaultTypes = new Set(defaults.map((setting) => setting.type));
  const defaultsNormalized = defaults.map(defaultSetting => {
    const current = incoming.find(setting => setting.type === defaultSetting.type);
    return {
      ...defaultSetting,
      id: current?.id ?? defaultSetting.id,
      payload: current?.payload ?? defaultSetting.payload,
      enabled: current?.enabled ?? defaultSetting.enabled,
      order: current?.order ?? defaultSetting.order
    };
  });

  const customTiles = incoming
    .filter(setting => !defaultTypes.has(setting.type) && (setting.custom || setting.type.startsWith('custom-')))
    .map((setting, index) => ({
      ...setting,
      id: setting.id ?? `custom-${setting.type}-${index}`,
      custom: true,
      payload: setting.payload,
      order: setting.order ?? defaultsNormalized.length + index
    }));

  const systemTiles: TileSetting[] = [];

  if (includeSystem && !incoming.find(t => t.type === 'custom-migraine')) {
    systemTiles.push({
      id: 'system-migraine',
      type: 'custom-migraine',
      label: 'Migraine',
      enabled: true,
      order: defaultsNormalized.length + customTiles.length,
      custom: false,
      payload: {
        title: 'Migraine',
        icon: 'crisis_alert',
        migraine: {
          tempWarn1: 5,
          tempWarn2: 8,
          pressureWarn1: 6,
          pressureWarn2: 10
        }
      }
    });
  }

  if (includeSystem && !incoming.find(t => t.type === 'custom-pollution')) {
    systemTiles.push({
      id: 'system-pollution',
      type: 'custom-pollution',
      label: 'Pollution',
      enabled: true,
      order: defaultsNormalized.length + customTiles.length + systemTiles.length,
      custom: false,
      payload: {
        title: 'Pollution',
        icon: 'air',
        pollution: {
          keys: ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen', 'pm10', 'pm2_5', 'ozone']
        }
      }
    });
  }

  return [...defaultsNormalized, ...customTiles, ...systemTiles]
    .sort((a, b) => a.order - b.order)
    .map((setting, index) => ({ ...setting, order: index }));
}
