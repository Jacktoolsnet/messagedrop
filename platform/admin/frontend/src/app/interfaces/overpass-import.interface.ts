export interface OverpassImportSettings {
  id: number;
  enabled: boolean;
  datasets: string[];
  categories: string[];
  subcategories: Record<string, string[]>;
  scheduleType: 'daily' | 'weekly';
  weekday: number;
  hour: number;
  minute: number;
  timezone: string;
  refreshSource: boolean;
  lastTriggeredAt: number;
  updatedAt: number;
}

export interface OverpassImportCatalog {
  status: number;
  datasets: Array<{
    id: string;
    label: string;
    countryCode: string;
    regionCode: string;
  }>;
  categories: Record<string, string[]>;
}

export interface OverpassImportSettingsResponse {
  status: number;
  settings: OverpassImportSettings;
}
