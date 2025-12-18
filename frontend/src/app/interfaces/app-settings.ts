import { ConsentSettings } from "./consent-settings.interface";

export interface AppSettings {
    defaultTheme: string,
    themeMode: 'light' | 'dark' | 'system',
    detectLocationOnStart: boolean,
    persistStorage: boolean,
    enablePinterestContent: boolean,
    enableSpotifyContent: boolean,
    enableTenorContent: boolean,
    enableTikTokContent: boolean,
    enableYoutubeContent: boolean,
    consentSettings: ConsentSettings,
    legalVersion: number,
    acceptedLegalVersion?: number
}
