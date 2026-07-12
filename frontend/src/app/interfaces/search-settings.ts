export type SearchSettingsKey =
  | 'publicMessages'
  | 'secretDrops'
  | 'privateNotes'
  | 'privateImages'
  | 'privateDocuments'
  | 'experiences'
  | 'myExperiences'
  | 'wikipedia';

export interface SearchSettingsEntry {
  enabled: boolean;
  minZoom: number;
}

export type SearchSettings = Record<SearchSettingsKey, SearchSettingsEntry>;

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  publicMessages: { enabled: true, minZoom: 3 },
  secretDrops: { enabled: true, minZoom: 12 },
  privateNotes: { enabled: true, minZoom: 3 },
  privateImages: { enabled: true, minZoom: 3 },
  privateDocuments: { enabled: true, minZoom: 3 },
  experiences: { enabled: true, minZoom: 8 },
  myExperiences: { enabled: true, minZoom: 3 },
  wikipedia: { enabled: false, minZoom: 16 }
};
