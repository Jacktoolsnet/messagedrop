export interface MessageModerationResult {
    decision?: 'approved' | 'review' | 'rejected' | null;
    score?: number | null;
    flagged?: boolean | null;
    patternMatch?: boolean | null;
    requestSent?: boolean;
    requestId?: string | null;
}

export interface MessageCreateResponse {
    status: number;
    moderation?: MessageModerationResult | null;
    err?: string;
}
