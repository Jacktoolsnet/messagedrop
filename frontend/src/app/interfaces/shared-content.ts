export interface SharedContent {
    id: string;
    title: string;
    text: string;
    url: string;
    method: 'GET' | 'POST';
    timestamp: string;
}