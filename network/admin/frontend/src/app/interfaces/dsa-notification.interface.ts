export interface NotificationPayload {
  event?: string | null;
  body?: string | null;
  subject?: string | null;
  to?: string | null;
}

export interface NotificationMeta {
  success?: boolean;
  event?: string | null;
  error?: string | null;
}

export interface DsaNotification {
  id: string;
  noticeId: string | null;
  decisionId: string | null;
  stakeholder: 'reporter' | 'uploader' | 'other' | string;
  channel: 'email' | 'inapp' | 'webhook' | string;
  sentAt: number;
  payload: NotificationPayload | null;
  meta: NotificationMeta | null;
}

export interface ListNotificationsParams {
  noticeId?: string | null;
  decisionId?: string | null;
  stakeholder?: string | null;
  channel?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
}
