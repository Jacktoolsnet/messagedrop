export interface Multimedia {
    type: string; // 'youtube'|'tenor'|'spotify'|'tiktok'|'image'|'undefined'|...
    url: string;
    sourceUrl?: string;
    attribution?: string;
    title?: string;
    description?: string;
    contentId?: string; // e.g. YouTube video id, Spotify id, TikTok id
    oembed?: any;
}