export interface SharedContent {
    id: string;
    title?: string | null;
    text?: string | null;
    url?: string | null;
    method: 'GET' | 'POST';
    timestamp: string;
    type?: 'multimedia' | 'location' | 'unknown';
}
