export type DsaNoticeStatus =
    | 'RECEIVED'
    | 'UNDER_REVIEW'
    | 'DECIDED';

export const DSA_NOTICE_STATUSES: ReadonlyArray<DsaNoticeStatus> = [
    'RECEIVED',
    'UNDER_REVIEW',
    'DECIDED'
] as const;

export function isDsaNoticeStatus(v: unknown): v is DsaNoticeStatus {
    return typeof v === 'string' && (DSA_NOTICE_STATUSES as readonly string[]).includes(v);
}