export type SpeechVoiceMode = 'system' | 'custom';

export interface SpeechSettings {
  enabled: boolean;
  preferTranslatedText: boolean;
  autoStopOnNavigation: boolean;
  voiceMode: SpeechVoiceMode;
  voiceUri?: string;
  rate: number;
}

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  enabled: false,
  preferTranslatedText: true,
  autoStopOnNavigation: true,
  voiceMode: 'system',
  voiceUri: '',
  rate: 1
};
