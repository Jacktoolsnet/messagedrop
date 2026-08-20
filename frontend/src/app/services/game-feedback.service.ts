import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameFeedbackService {
  private readonly audioMutedStorageKey = 'messagedrop.gameFeedback.audioMuted';
  private audioContext: AudioContext | null = null;
  private lastHoverSoundAt = 0;
  readonly audioMuted = signal(this.readAudioMuted());

  notifyHover(): void {
    if (this.audioMuted()) {
      return;
    }
    const now = performance.now();
    if (now - this.lastHoverSoundAt < 60) {
      return;
    }
    this.lastHoverSoundAt = now;
    void this.playHoverSound();
  }

  notifySelection(): void {
    this.tryVibrate([18, 24, 26]);
    if (!this.audioMuted()) {
      void this.playSelectionSound();
    }
  }

  toggleAudioMuted(): void {
    const muted = !this.audioMuted();
    this.audioMuted.set(muted);
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(this.audioMutedStorageKey, String(muted));
    } catch {
      // Persisting the optional preference may be blocked by the browser.
    }
  }

  private async playHoverSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) {
      return;
    }

    this.playTone(context, context.currentTime, 480, 620, 0.07, 0.018, 'sine');
  }

  private async playSelectionSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    this.playTone(context, now, 420, 560, 0.14, 0.04, 'triangle');
    this.playTone(context, now + 0.075, 620, 780, 0.16, 0.028, 'sine');
  }

  private playTone(
    context: AudioContext,
    startTime: number,
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const endTime = startTime + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, endTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
  }

  private tryVibrate(pattern: number | number[]): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch {
      // Haptic feedback is optional and must never prevent a move.
    }
  }

  private async getReadyAudioContext(): Promise<AudioContext | null> {
    const AudioContextCtor = this.getAudioContextConstructor();
    if (!AudioContextCtor) {
      return null;
    }

    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContextCtor();
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        return null;
      }
    }

    return this.audioContext;
  }

  private getAudioContextConstructor(): typeof AudioContext | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  }

  private readAudioMuted(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    try {
      return localStorage.getItem(this.audioMutedStorageKey) === 'true';
    } catch {
      return false;
    }
  }
}
