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
    continentCode: string;
    continentLabel: string;
    countryCode: string;
    countryLabel: string;
    regionCode: string | null;
    level: 'country' | 'state' | 'test';
  }>;
  categories: Record<string, string[]>;
}

export interface OverpassImportSettingsResponse {
  status: number;
  settings: OverpassImportSettings;
}

export interface OverpassImportJob {
  jobId: string;
  datasetId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  stage: string;
  progress: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OverpassDatabaseInfo {
  status: number;
  health: {
    status: number;
    mode?: string;
    local?: {
      datasetCount: number;
      poiCount: number;
      importedAt: string | null;
      databaseBytes: number | null;
    };
  };
  jobs: OverpassImportJob[];
}
