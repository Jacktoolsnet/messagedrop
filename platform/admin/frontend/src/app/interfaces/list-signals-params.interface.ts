export interface ListSignalsParams {
    type?: string;        // reportedContentType
    category?: string;
    since?: number;       // unix ms
    limit?: number;
    offset?: number;
    q?: string;           // optional fulltext on reason, etc.
}