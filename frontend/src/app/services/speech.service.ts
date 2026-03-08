import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from './app.service';
import { DEFAULT_SPEECH_SETTINGS } from '../interfaces/speech-settings';

export interface SpeechRequest {
  targetId: string;
  text: string;
  lang?: string;
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

  speak(request: SpeechRequest): boolean {
    const text = request.text.trim();
    if (!text || !this.supported() || !this.synth) {
      return false;
    }

    const settings = this.getSpeechSettings();
    if (!settings.enabled) {
      return false;
    }

    this.init();
    this.stop();

    const token = ++this.playbackToken;
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.resolveVoice(request.lang);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else if (request.lang) {
      utterance.lang = request.lang;
    }

    utterance.rate = settings.rate;

    utterance.onstart = () => {
      if (token !== this.playbackToken) {
        return;
      }
      this.currentTargetId.set(request.targetId);
      this.currentText.set(text);
      this.speaking.set(true);
      this.paused.set(false);
      this.error.set(null);
    };

    utterance.onpause = () => {
      if (token !== this.playbackToken) {
        return;
      }
      this.paused.set(true);
      this.speaking.set(true);
    };

    utterance.onresume = () => {
      if (token !== this.playbackToken) {
        return;
      }
      this.paused.set(false);
      this.speaking.set(true);
    };

    utterance.onend = () => {
      if (token !== this.playbackToken) {
        return;
      }
      this.clearPlaybackState();
    };

    utterance.onerror = (event) => {
      if (token !== this.playbackToken) {
        return;
      }
      this.error.set(event.error || 'speech_error');
      this.clearPlaybackState();
    };

    this.activeUtterance = utterance;
    this.currentTargetId.set(request.targetId);
    this.currentText.set(text);
    this.error.set(null);
    this.paused.set(false);
    this.speaking.set(false);
    this.synth.speak(utterance);
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

  toggle(request: SpeechRequest): boolean {
    if (this.isActive(request.targetId)) {
      this.stop();
      return false;
    }
    return this.speak(request);
  }

  isActive(targetId: string): boolean {
    return this.currentTargetId() === targetId && (!!this.activeUtterance || this.speaking() || this.paused());
  }

  isPaused(targetId: string): boolean {
    return this.currentTargetId() === targetId && this.paused();
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

  private resolveVoice(lang?: string): SpeechSynthesisVoice | undefined {
    const settings = this.getSpeechSettings();
    const voices = this.voices();
    if (!voices.length) {
      return undefined;
    }

    if (settings.voiceMode === 'custom' && settings.voiceUri) {
      const customVoice = voices.find((voice) => voice.voiceURI === settings.voiceUri);
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

  private getSpeechSettings() {
    return this.appService.getAppSettings().speech ?? DEFAULT_SPEECH_SETTINGS;
  }

  private clearPlaybackState(): void {
    this.activeUtterance = null;
    this.currentTargetId.set(null);
    this.currentText.set('');
    this.speaking.set(false);
    this.paused.set(false);
  }
}
