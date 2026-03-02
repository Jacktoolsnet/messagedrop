export interface ListAuditParams {
    entityType?: 'notice' | 'signal' | 'decision' | 'public_message' | 'user' | 'other';
    action?: 'create' | 'status_change' | 'evidence_add' | 'notify' | 'delete';
    since?: number;  // unix ms
    q?: string;
    limit?: number;
    offset?: number;
}
