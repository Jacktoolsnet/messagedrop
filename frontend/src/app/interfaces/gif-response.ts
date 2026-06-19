export interface GifFormat {
  url: string;
}

export interface GifMediaFormats {
  gif: GifFormat;
  tinygif?: GifFormat;
}

export interface GifResult {
  id: string;
  itemurl: string;
  title: string;
  content_description: string;
  media_formats: GifMediaFormats;
}

export interface GifApiData {
  results: GifResult[];
  next: string;
}

export interface GifApiResponse {
  data: GifApiData;
}
