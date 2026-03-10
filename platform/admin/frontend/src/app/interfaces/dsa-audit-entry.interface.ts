export type DsaAuditEntityType =
    | 'notice'
    | 'decision'
    | 'signal'
    | 'public_message'
    | 'platform_user'
    | 'user'
    | 'other';

export interface DsaAuditEntry {
    id: string;
    entityType: DsaAuditEntityType;
    entityId: string;
    action: string;
    actor: string;
    createdAt: number;
    details?: Record<string, unknown> | null;
}
