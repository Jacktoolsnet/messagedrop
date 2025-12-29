import { Multimedia } from "./multimedia.interface";

export interface PublicMessage {
    id: number;
    uuid: string;
    typ: 'public' | string;
    createDateTime: number;
    deleteDateTime?: number;
    location?: { latitude: number; longitude: number; plusCode?: string };
    message: string;
    markerType?: string;
    style?: string; // inline css from your example
    views?: number;
    likes?: number;
    dislikes?: number;
    comments?: unknown[];
    commentsNumber?: number;
    status?: string;
    aiModerationDecision?: string | null;
    aiModerationScore?: number | null;
    aiModerationFlagged?: boolean | number | null;
    aiModerationAt?: number | null;
    patternMatch?: boolean | number | null;
    patternMatchAt?: number | null;
    manualModerationDecision?: string | null;
    manualModerationReason?: string | null;
    manualModerationAt?: number | null;
    manualModerationBy?: string | null;
    userId: string;
    multimedia: Multimedia;
}
