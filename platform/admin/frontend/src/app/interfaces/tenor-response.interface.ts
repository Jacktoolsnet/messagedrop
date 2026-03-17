export interface TenorGifFormat {
  url: string;
}

export interface TenorMediaFormats {
  gif: TenorGifFormat;
}

export interface TenorResult {
  id: string;
  itemurl: string;
  title: string;
  content_description: string;
  media_formats: TenorMediaFormats;
}

export interface TenorApiData {
  results: TenorResult[];
  next: string;
}

export interface TenorApiResponse {
  data: TenorApiData;
}
