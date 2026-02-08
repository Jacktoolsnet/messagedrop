import { ConsentSettings } from "./consent-settings.interface";
import { UsageProtectionSettings } from "./usage-protection-settings";

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
    enableUnsplashContent: boolean,
    enableTikTokContent: boolean,
    enableYoutubeContent: boolean,
    diagnosticLogging: boolean,
    backupOnExit: boolean,
    usageProtection: UsageProtectionSettings,
    consentSettings: ConsentSettings,
    legalVersion: number,
    acceptedLegalVersion?: number
}
