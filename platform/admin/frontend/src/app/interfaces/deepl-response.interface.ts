export interface DeeplResponse {
    status: number;
    // deepl-node kann Array oder Single zurückgeben; wir normalisieren auf string
    result: { text: string } | { text: string }[];
}
