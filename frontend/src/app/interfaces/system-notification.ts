export type SystemNotificationStatus = 'unread' | 'read' | 'archived';
export type SystemNotificationFilter = 'unread' | 'read' | 'all';

export interface SystemNotificationMetadata {
  contentId?: string;
  messageId?: number;
  category?: string;
  reasonText?: string;
  reportedContentType?: string;
  dsa?: {
    type?: string;
    caseId?: string;
    token?: string;
    statusUrl?: string;
  };
  [key: string]: unknown;
}

export interface SystemNotification {
  id: number;
  uuid: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  source: string | null;
  status: SystemNotificationStatus;
  metadata: SystemNotificationMetadata | null;
  createdAt: number;
  readAt: number | null;
}
