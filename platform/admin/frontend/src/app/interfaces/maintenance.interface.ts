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

export interface MaintenanceBackupListItem extends MaintenanceBackupInfo {
  valid: boolean;
  issues: string[];
}

export interface MaintenanceBackupResponse {
  status: number;
  backup: MaintenanceBackupInfo | null;
  maintenanceTemporarilyEnabled?: boolean;
}

export interface MaintenanceBackupListResponse {
  status: number;
  backups: MaintenanceBackupListItem[];
}

export interface MaintenanceBackupValidationResponse {
  status: number;
  backup: MaintenanceBackupInfo | null;
  valid: boolean;
  issues: string[];
}

export interface MaintenanceRestoreChallenge {
  challengeId: string;
  confirmationWord: string;
  confirmationPin: string;
  expiresAt: number;
}

export interface MaintenanceRestoreChallengeResponse {
  status: number;
  backup: MaintenanceBackupInfo;
  valid: boolean;
  issues: string[];
  challenge: MaintenanceRestoreChallenge;
}

export interface PendingRestoreInfo {
  backupId: string;
  archiveName: string;
  directoryName: string;
  preparedAt: number | null;
  preparedBy: string | null;
  databases: MaintenanceBackupDatabaseInfo[];
}

export interface LastRestoreInfo {
  status: string;
  backupId: string;
  archiveName: string;
  message: string | null;
  preparedAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  preparedBy: string | null;
  databases: MaintenanceBackupDatabaseInfo[];
}

export interface MaintenanceRestoreStatusResponse {
  status: number;
  pendingRestore: PendingRestoreInfo | null;
  lastRestore: LastRestoreInfo | null;
}

export interface MaintenanceRestorePrepareResponse extends MaintenanceRestoreStatusResponse {
  pendingRestore: PendingRestoreInfo;
}
