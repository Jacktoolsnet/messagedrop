export interface FrontendErrorLogEntry {
    id: string;
    client: string;
    event: string;
    severity: string;
    feature?: string;
    path?: string;
    status?: number;
    errorName?: string;
    errorMessage?: string;
    stack?: string;
    source?: string;
    line?: number;
    column?: number;
    errorCode?: string;
    appVersion?: string;
    environment?: string;
    createdAt: number;
}
