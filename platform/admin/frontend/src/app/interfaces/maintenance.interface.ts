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
