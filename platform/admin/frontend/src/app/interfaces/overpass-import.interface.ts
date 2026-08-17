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
  stepNumber?: number;
  stepCount?: number;
  stepProgress?: number | null;
  processedBytes?: number | string | null;
  totalBytes?: number | string | null;
  processedItems?: number | string | null;
  stepStartedAt?: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface OverpassMetadataJob {
  metadataJobId: string;
  status: 'running' | 'succeeded' | 'failed';
  triggerReason: string;
  totalUrls: number;
  processedUrls: number;
  succeededUrls: number;
  failedUrls: number;
  error: string | null;
  createdAt: string;
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
      websitePoiCount?: number;
      websiteMetadataPoiCount?: number;
      importedAt: string | null;
      databaseBytes: number | null;
    };
  };
  jobs: OverpassImportJob[];
  metadataJobs?: OverpassMetadataJob[];
}
