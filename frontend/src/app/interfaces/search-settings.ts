export type SearchSettingsKey =
  | 'publicMessages'
  | 'privateNotes'
  | 'privateImages'
  | 'privateDocuments';

export interface SearchSettingsEntry {
  enabled: boolean;
  minZoom: number;
}

export type SearchSettings = Record<SearchSettingsKey, SearchSettingsEntry>;

export const DEFAULT_SEARCH_SETTINGS: SearchSettings = {
  publicMessages: { enabled: true, minZoom: 3 },
  privateNotes: { enabled: true, minZoom: 3 },
  privateImages: { enabled: true, minZoom: 3 },
  privateDocuments: { enabled: true, minZoom: 3 }
};
