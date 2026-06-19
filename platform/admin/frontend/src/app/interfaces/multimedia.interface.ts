export interface MultimediaOembed {
    html?: string | null;
}

export interface Multimedia {
    type: string;
    mediaKind?: 'gif' | 'sticker' | 'clip' | 'meme'; // 'youtube'|'tenor'|'klipy'|'spotify'|'tiktok'|'image'|'undefined'|...
    url: string;
    sourceUrl?: string;
    attribution?: string;
    title?: string;
    description?: string;
    contentId?: string; // e.g. YouTube video id, Spotify id, TikTok id
    oembed?: MultimediaOembed | null;
}
