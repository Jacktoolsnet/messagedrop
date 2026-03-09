import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';
import { DEFAULT_SPEECH_SETTINGS, SpeechSettings } from '../interfaces/speech-settings';

export interface SpeechRequest {
  targetId: string;
  text: string;
  lang?: string;
}

interface SpeechPlayback {
  chunks: string[];
  fullText: string;
  targetId: string;
  token: number;
  rate: number;
  voice?: SpeechSynthesisVoice;
  fallbackLang?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechService {
  private readonly appService = inject(AppService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly synth =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;

  private voicesListenerRegistered = false;
  private playbackToken = 0;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  readonly supported = signal(
    typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window
  );
  readonly voices = signal<SpeechSynthesisVoice[]>([]);
  readonly speaking = signal(false);
  readonly paused = signal(false);
  readonly currentTargetId = signal<string | null>(null);
  readonly currentText = signal('');
  readonly error = signal<string | null>(null);

  constructor() {
    if (this.supported()) {
      this.init();
    }

    effect(() => {
      this.appService.settingsSet();
      if (!this.appService.getAppSettings().speech?.enabled) {
        this.stop();
      }
    });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (this.appService.getAppSettings().speech?.autoStopOnNavigation) {
          this.stop();
        }
      });
  }

  init(): void {
    if (!this.supported() || !this.synth) {
      return;
    }

    this.refreshVoices();

    if (!this.voicesListenerRegistered) {
      this.synth.addEventListener('voiceschanged', this.refreshVoices);
      this.voicesListenerRegistered = true;
    }
  }

  speak(request: SpeechRequest, settingsOverride?: Partial<SpeechSettings>): boolean {
    const text = request.text.trim();
    if (!text || !this.supported() || !this.synth) {
      return false;
    }

    const settings = this.getSpeechSettings(settingsOverride);
    if (!settings.enabled) {
      return false;
    }

    this.init();
    this.stop();

    const token = ++this.playbackToken;
    const chunks = this.splitIntoChunks(text);
    if (!chunks.length) {
      return false;
    }

    const voice = this.resolveVoice(request.lang, settingsOverride);
    this.currentTargetId.set(request.targetId);
    this.currentText.set(text);
    this.error.set(null);
    this.paused.set(false);
    this.speaking.set(false);
    this.playChunks({
      chunks,
      fullText: text,
      targetId: request.targetId,
      token,
      rate: settings.rate,
      voice,
      fallbackLang: request.lang
    });

    return true;
  }

  pause(): void {
    if (!this.supported() || !this.synth || !this.synth.speaking || this.synth.paused) {
      return;
    }
    this.synth.pause();
    this.paused.set(true);
  }

  resume(): void {
    if (!this.supported() || !this.synth || !this.synth.paused) {
      return;
    }
    this.synth.resume();
    this.paused.set(false);
    this.speaking.set(true);
  }

  stop(): void {
    if (this.synth) {
      this.playbackToken += 1;
      this.synth.cancel();
    }
    this.clearPlaybackState();
  }

  toggle(request: SpeechRequest, settingsOverride?: Partial<SpeechSettings>): boolean {
    if (this.isActive(request.targetId)) {
      this.stop();
      return false;
    }
    return this.speak(request, settingsOverride);
  }

  isActive(targetId: string): boolean {
    return this.currentTargetId() === targetId && (!!this.activeUtterance || this.speaking() || this.paused());
  }

  isPaused(targetId: string): boolean {
    return this.currentTargetId() === targetId && this.paused();
  }

  getRecommendedVoice(lang?: string, settingsOverride?: Partial<SpeechSettings>): SpeechSynthesisVoice | undefined {
    this.init();
    return this.resolveVoice(lang, settingsOverride);
  }

  getVoiceStorageId(voice: SpeechSynthesisVoice): string {
    const uri = (voice.voiceURI || '').trim();
    if (uri) {
      return `uri:${uri}`;
    }
    return `name:${voice.name}::${voice.lang}`;
  }

  stopIfCurrentTarget(targetId: string): void {
    if (this.currentTargetId() === targetId) {
      this.stop();
    }
  }

  private readonly refreshVoices = (): void => {
    if (!this.supported() || !this.synth) {
      this.voices.set([]);
      return;
    }
    const voices = this.synth.getVoices();
    this.voices.set(
      [...voices].sort((a, b) =>
        `${a.lang}-${a.name}`.localeCompare(`${b.lang}-${b.name}`)
      )
    );
  };

  private resolveVoice(lang?: string, settingsOverride?: Partial<SpeechSettings>): SpeechSynthesisVoice | undefined {
    const settings = this.getSpeechSettings(settingsOverride);
    const voices = this.voices();
    if (!voices.length) {
      return undefined;
    }

    if (settings.voiceMode === 'custom' && settings.voiceUri) {
      const customVoice = voices.find((voice) => this.matchesStoredVoiceId(settings.voiceUri ?? '', voice));
      if (customVoice) {
        return customVoice;
      }
    }

    if (lang) {
      const normalized = lang.toLowerCase();
      const exactMatch = voices.find((voice) => voice.lang.toLowerCase() === normalized);
      if (exactMatch) {
        return exactMatch;
      }
      const prefixMatch = voices.find((voice) => voice.lang.toLowerCase().startsWith(`${normalized.split('-')[0]}-`));
      if (prefixMatch) {
        return prefixMatch;
      }
    }

    return voices.find((voice) => voice.default) ?? voices[0];
  }

  private getSpeechSettings(settingsOverride?: Partial<SpeechSettings>): SpeechSettings {
    return {
      ...(this.appService.getAppSettings().speech ?? DEFAULT_SPEECH_SETTINGS),
      ...(settingsOverride ?? {})
    };
  }

  private playChunks(playback: SpeechPlayback, index = 0): void {
    if (!this.synth || index >= playback.chunks.length || playback.token !== this.playbackToken) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(playback.chunks[index]);

    if (playback.voice) {
      utterance.voice = playback.voice;
      utterance.lang = playback.voice.lang;
    } else if (playback.fallbackLang) {
      utterance.lang = playback.fallbackLang;
    }

    utterance.rate = playback.rate;

    utterance.onstart = () => {
      if (playback.token !== this.playbackToken) {
        return;
      }
      this.currentTargetId.set(playback.targetId);
      this.currentText.set(playback.fullText);
      this.speaking.set(true);
      this.paused.set(false);
      this.error.set(null);
    };

    utterance.onpause = () => {
      if (playback.token !== this.playbackToken) {
        return;
      }
      this.paused.set(true);
      this.speaking.set(true);
    };

    utterance.onresume = () => {
      if (playback.token !== this.playbackToken) {
        return;
      }
      this.paused.set(false);
      this.speaking.set(true);
    };

    utterance.onend = () => {
      if (playback.token !== this.playbackToken) {
        return;
      }

      if (index < playback.chunks.length - 1) {
        this.activeUtterance = null;
        this.speaking.set(true);
        this.paused.set(false);
        this.playChunks(playback, index + 1);
        return;
      }

      this.clearPlaybackState();
    };

    utterance.onerror = (event) => {
      if (playback.token !== this.playbackToken) {
        return;
      }
      this.error.set(event.error || 'speech_error');
      this.clearPlaybackState();
    };

    this.activeUtterance = utterance;
    this.synth.speak(utterance);
  }

  private splitIntoChunks(text: string): string[] {
    const normalized = text
      .replace(/\r\n/g, '\n')
      .replace(/\u00a0/g, ' ')
      .trim();

    if (!normalized) {
      return [];
    }

    const paragraphs = normalized
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    const parts = paragraphs.length ? paragraphs : [normalized];

    for (const part of parts) {
      this.pushChunks(part, chunks);
    }

    return chunks;
  }

  private pushChunks(text: string, chunks: string[]): void {
    const maxLength = 220;
    let remaining = text.trim();

    while (remaining.length > maxLength) {
      const breakIndex = this.findChunkBreak(remaining, maxLength);
      const chunk = remaining.slice(0, breakIndex).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      remaining = remaining.slice(breakIndex).trim();
    }

    if (remaining) {
      chunks.push(remaining);
    }
  }

  private findChunkBreak(text: string, maxLength: number): number {
    const minLength = Math.floor(maxLength * 0.5);

    return this.findBoundaryIndex(text, /[\.\!\?]\s+/g, maxLength, minLength)
      ?? this.findBoundaryIndex(text, /[;:]\s+/g, maxLength, minLength)
      ?? this.findBoundaryIndex(text, /,\s+/g, maxLength, minLength)
      ?? this.findBoundaryIndex(text, /\n+/g, maxLength, minLength)
      ?? this.findBoundaryIndex(text, /\s+/g, maxLength, minLength)
      ?? maxLength;
  }

  private findBoundaryIndex(
    text: string,
    pattern: RegExp,
    maxLength: number,
    minLength: number
  ): number | null {
    let candidate: number | null = null;
    let match: RegExpExecArray | null = null;

    while ((match = pattern.exec(text)) !== null) {
      const matchEnd = match.index + match[0].length;

      if (matchEnd > maxLength) {
        break;
      }

      if (matchEnd >= minLength) {
        candidate = matchEnd;
      }
    }

    return candidate;
  }

  private clearPlaybackState(): void {
    this.activeUtterance = null;
    this.currentTargetId.set(null);
    this.currentText.set('');
    this.speaking.set(false);
    this.paused.set(false);
  }

  private matchesStoredVoiceId(storedId: string, voice: SpeechSynthesisVoice): boolean {
    const normalizedStoredId = (storedId || '').trim();
    if (!normalizedStoredId) {
      return false;
    }

    if (normalizedStoredId === this.getVoiceStorageId(voice)) {
      return true;
    }

    const voiceUri = (voice.voiceURI || '').trim();
    if (voiceUri && normalizedStoredId === voiceUri) {
      return true;
    }

    return normalizedStoredId === `${voice.name}::${voice.lang}`;
  }
}
