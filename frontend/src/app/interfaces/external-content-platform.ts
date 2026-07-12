import { AppSettings } from './app-settings';

export const EXTERNAL_CONTENT_PLATFORMS = [
  'pinterest',
  'spotify',
  'tenor',
  'klipy',
  'unsplash',
  'tiktok',
  'youtube',
  'wikipedia'
] as const;

export type ExternalContentPlatform = typeof EXTERNAL_CONTENT_PLATFORMS[number];

export const EXTERNAL_CONTENT_SETTINGS_KEYS: Record<ExternalContentPlatform, keyof Pick<
  AppSettings,
  | 'enablePinterestContent'
  | 'enableSpotifyContent'
  | 'enableTenorContent'
  | 'enableKlipyContent'
  | 'enableUnsplashContent'
  | 'enableTikTokContent'
  | 'enableYoutubeContent'
  | 'enableWikipediaContent'
>> = {
  pinterest: 'enablePinterestContent',
  spotify: 'enableSpotifyContent',
  tenor: 'enableTenorContent',
  klipy: 'enableKlipyContent',
  unsplash: 'enableUnsplashContent',
  tiktok: 'enableTikTokContent',
  youtube: 'enableYoutubeContent',
  wikipedia: 'enableWikipediaContent'
};

export function isExternalContentPlatform(value: string | undefined): value is ExternalContentPlatform {
  return value !== undefined && EXTERNAL_CONTENT_PLATFORMS.includes(value as ExternalContentPlatform);
}
