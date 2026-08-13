import { OVERPASS_SUBCATEGORIES, OverpassCategory } from './overpass';

export interface SearchSettingsEntry {
  enabled: boolean;
  minZoom: number;
}

export interface PoiSearchSettingsEntry extends SearchSettingsEntry {
  subcategories: Record<string, boolean>;
}

export interface SearchSettings {
  publicMessages: SearchSettingsEntry;
  secretDrops: SearchSettingsEntry;
  privateNotes: SearchSettingsEntry;
  privateImages: SearchSettingsEntry;
  privateDocuments: SearchSettingsEntry;
  experiences: SearchSettingsEntry;
  myExperiences: SearchSettingsEntry;
  wikipedia: SearchSettingsEntry;
  publicTransportStops: SearchSettingsEntry;
  accommodation: PoiSearchSettingsEntry;
  tourism: PoiSearchSettingsEntry;
  leisure: PoiSearchSettingsEntry;
  food_drink: PoiSearchSettingsEntry;
  amenities: PoiSearchSettingsEntry;
}

export type SearchSettingsKey = keyof SearchSettings;

function poiDefaults(category: OverpassCategory, minZoom = 14): PoiSearchSettingsEntry {
  return {
    enabled: false,
    minZoom,
    subcategories: Object.fromEntries(OVERPASS_SUBCATEGORIES[category].map((subcategory) => [subcategory, true]))
  };
}

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  publicMessages: { enabled: true, minZoom: 3 },
  secretDrops: { enabled: true, minZoom: 12 },
  privateNotes: { enabled: true, minZoom: 3 },
  privateImages: { enabled: true, minZoom: 3 },
  privateDocuments: { enabled: true, minZoom: 3 },
  experiences: { enabled: true, minZoom: 8 },
  myExperiences: { enabled: true, minZoom: 3 },
  wikipedia: { enabled: true, minZoom: 14 },
  publicTransportStops: { enabled: true, minZoom: 16 },
  accommodation: poiDefaults('accommodation'),
  tourism: poiDefaults('tourism'),
  leisure: poiDefaults('leisure'),
  food_drink: poiDefaults('food_drink'),
  amenities: poiDefaults('amenities', 15)
};

export function normalizePoiSetting(
  category: OverpassCategory,
  setting: Partial<PoiSearchSettingsEntry> | undefined
): PoiSearchSettingsEntry {
  const fallback = DEFAULT_SEARCH_SETTINGS[category] as PoiSearchSettingsEntry;
  const stored = setting?.subcategories ?? {};
  return {
    ...fallback,
    ...setting,
    minZoom: Math.min(19, Math.max(14, setting?.minZoom ?? fallback.minZoom)),
    subcategories: Object.fromEntries(OVERPASS_SUBCATEGORIES[category]
      .map((subcategory) => [subcategory, stored[subcategory] ?? fallback.subcategories[subcategory]]))
  };
}
