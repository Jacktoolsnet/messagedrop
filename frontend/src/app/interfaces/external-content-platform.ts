import { AppSettings } from './app-settings';

export const EXTERNAL_CONTENT_PLATFORMS = [
  'pinterest',
  'spotify',
  'tenor',
  'unsplash',
  'tiktok',
  'youtube'
] as const;

export type ExternalContentPlatform = typeof EXTERNAL_CONTENT_PLATFORMS[number];

export const EXTERNAL_CONTENT_SETTINGS_KEYS: Record<ExternalContentPlatform, keyof Pick<
  AppSettings,
  | 'enablePinterestContent'
  | 'enableSpotifyContent'
  | 'enableTenorContent'
  | 'enableUnsplashContent'
  | 'enableTikTokContent'
  | 'enableYoutubeContent'
>> = {
  pinterest: 'enablePinterestContent',
  spotify: 'enableSpotifyContent',
  tenor: 'enableTenorContent',
  unsplash: 'enableUnsplashContent',
  tiktok: 'enableTikTokContent',
  youtube: 'enableYoutubeContent'
};

export function isExternalContentPlatform(value: string | undefined): value is ExternalContentPlatform {
  return value !== undefined && EXTERNAL_CONTENT_PLATFORMS.includes(value as ExternalContentPlatform);
}
