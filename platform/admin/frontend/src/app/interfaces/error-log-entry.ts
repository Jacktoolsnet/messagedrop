export interface ErrorLogEntry {
    id: string;
    source: string;
    file: string;
    message: string;
    detail?: string | null;
    createdAt: number;
}
