export interface DsaEvidence {
    id: string;
    noticeId: string;
    type: string;
    url?: string | null;
    hash?: string | null;
    fileName?: string | null;
    filePath?: string | null;
    addedAt: number;
}
