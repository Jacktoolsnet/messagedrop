import { ConsentSettings } from "./consent-settings.interface";

export interface AppSettings {
    languageMode?: 'system' | 'en' | 'de' | 'es' | 'fr',
    language?: 'en' | 'de' | 'es' | 'fr',
    defaultTheme: string,
    themeMode: 'light' | 'dark' | 'system',
    detectLocationOnStart: boolean,
    persistStorage: boolean,
    enablePinterestContent: boolean,
    enableSpotifyContent: boolean,
    enableTenorContent: boolean,
    enableTikTokContent: boolean,
    enableYoutubeContent: boolean,
    backupOnExit: boolean,
    consentSettings: ConsentSettings,
    legalVersion: number,
    acceptedLegalVersion?: number
}
