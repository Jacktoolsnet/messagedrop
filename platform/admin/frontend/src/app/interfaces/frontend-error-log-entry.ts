export interface FrontendErrorLogEntry {
    id: string;
    client: string;
    event: string;
    severity: string;
    feature?: string;
    path?: string;
    status?: number;
    errorName?: string;
    errorCode?: string;
    appVersion?: string;
    environment?: string;
    createdAt: number;
}
