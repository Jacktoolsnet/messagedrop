export interface ListAuditParams {
    entityType?: 'notice' | 'signal' | 'decision' | 'public_message' | 'platform_user' | 'user' | 'other';
    action?: string;
    since?: number;  // unix ms
    q?: string;
    limit?: number;
    offset?: number;
}
