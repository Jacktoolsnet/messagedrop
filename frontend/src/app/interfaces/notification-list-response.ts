import { SystemNotification } from './system-notification';

export interface NotificationListResponse {
  status: number;
  rows: SystemNotification[];
}
