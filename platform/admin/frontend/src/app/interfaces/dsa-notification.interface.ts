export interface DsaNotification {
  id: string;
  noticeId: string | null;
  decisionId: string | null;
  stakeholder: 'reporter' | 'uploader' | 'other' | string;
  channel: 'email' | 'inapp' | 'webhook' | string;
  sentAt: number;
  payload: any;
  meta: {
    success?: boolean;
    event?: string | null;
    error?: string | null;
    [key: string]: any;
  } | null;
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
