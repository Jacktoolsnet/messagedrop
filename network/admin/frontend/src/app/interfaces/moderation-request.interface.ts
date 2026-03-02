export interface ModerationRequest {
    id: string;
    messageId?: number | null;
    messageUuid: string;
    messageUserId: string;
    messageText: string;
    messageType?: string | null;
    messageCreatedAt?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    plusCode?: string | null;
    markerType?: string | null;
    style?: string | null;
    aiScore?: number | null;
    aiFlagged?: number | boolean | null;
    aiDecision?: string | null;
    aiResponse?: string | null;
    patternMatch?: number | boolean | null;
    patternMatchAt?: number | null;
    status?: string;
    createdAt?: number;
}
