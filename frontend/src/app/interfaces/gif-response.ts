export interface GifFormat {
  url: string;
}

export interface GifMediaFormats {
  gif: GifFormat;
  tinygif?: GifFormat;
  mp4?: GifFormat;
  webm?: GifFormat;
  jpg?: GifFormat;
  webp?: GifFormat;
}

export interface GifResult {
  id: string;
  itemurl: string;
  title: string;
  content_description: string;
  media_kind?: 'gif' | 'sticker' | 'clip' | 'meme';
  media_formats: GifMediaFormats;
}

export interface GifApiData {
  results: GifResult[];
  next: string;
}

export interface GifApiResponse {
  data: GifApiData;
}
