export interface MaintenanceInfo {
  enabled: boolean;
  startsAt: number | null;
  endsAt: number | null;
  reason: string | null;
  reasonEn?: string | null;
  reasonEs?: string | null;
  reasonFr?: string | null;
  updatedAt?: number | null;
}

export interface MaintenanceResponse {
  status: number;
  maintenance: MaintenanceInfo;
}

export interface MaintenanceBackupDatabaseInfo {
  key: string;
  label: string;
  fileName: string;
  relativeSourcePath?: string | null;
  sizeBytes: number;
}

export interface MaintenanceBackupInfo {
  id: string;
  createdAt: number | null;
  directoryName: string;
  archiveName: string;
  archiveSizeBytes: number;
  databases: MaintenanceBackupDatabaseInfo[];
  downloadPath: string;
}

export interface MaintenanceBackupResponse {
  status: number;
  backup: MaintenanceBackupInfo | null;
  maintenanceTemporarilyEnabled?: boolean;
}
