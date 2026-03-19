export interface UnsplashPhotoUrls {
  raw: string;
  full: string;
  regular: string;
  small: string;
  thumb: string;
}

export interface UnsplashUser {
  id: string;
  username: string;
  name: string;
}

export interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  description: string | null;
  alt_description: string | null;
  urls: UnsplashPhotoUrls;
  user: UnsplashUser;
  links?: {
    html?: string;
    download_location?: string;
  };
}

export interface UnsplashSearchResults {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

export interface UnsplashApiResponse<T> {
  data: T;
}
