export type DsaNotificationStakeholder = 'reporter' | 'uploader' | 'other';
export type DsaNotificationChannel = 'email' | 'inapp' | 'webhook';

export interface DsaNotification {
    id: string;
    noticeId?: string | null;
    decisionId?: string | null;
    stakeholder: DsaNotificationStakeholder;
    channel: DsaNotificationChannel;
    sentAt: number;
    payload: Record<string, unknown>;
    meta?: Record<string, unknown> | null;
}