export interface WikipediaThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface WikipediaArticle {
  pageId: number;
  title: string;
  latitude: number;
  longitude: number;
  summary: string;
  thumbnail: WikipediaThumbnail | null;
  articleUrl: string;
}

export interface WikipediaAttribution {
  provider: string;
  url: string;
  textLicense: string;
  licenseUrl: string;
}

export interface WikipediaCacheStatus {
  stale: boolean;
  tiles: ('hit' | 'miss' | 'stale')[];
}

export interface WikipediaNearbyResponse {
  status: number;
  language: string;
  articles: WikipediaArticle[];
  cache: WikipediaCacheStatus;
  attribution: WikipediaAttribution;
}

export interface WikipediaViewport {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

export interface WikipediaNearbyRequest extends WikipediaViewport {
  language: string;
  limit?: number;
}
