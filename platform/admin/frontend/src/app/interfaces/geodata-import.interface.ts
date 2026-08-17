export interface GeodataImportSettings {
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

export interface GeodataImportCatalog {
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

export interface GeodataImportSettingsResponse {
  status: number;
  settings: GeodataImportSettings;
}

export interface GeodataImportJob {
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
  sourceTimestamp?: string | null;
  sourceEtag?: string | null;
  sourceChanged?: boolean | null;
  stepStartedAt?: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface GeodataMetadataJob {
  metadataJobId: string;
  status: 'running' | 'succeeded' | 'failed';
  stage?: 'discovering' | 'processing' | 'completed' | 'failed';
  triggerReason: string;
  totalUrls: number;
  processedUrls: number;
  succeededUrls: number;
  failedUrls: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface GeodataDatabaseInfo {
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
  jobs: GeodataImportJob[];
  metadataJobs?: GeodataMetadataJob[];
}
