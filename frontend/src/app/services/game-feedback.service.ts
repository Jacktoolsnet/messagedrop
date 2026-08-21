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

  notifyCorrect(): void {
    this.tryVibrate([35, 35, 55, 35, 80]);
    if (!this.audioMuted()) void this.playCorrectSound();
  }

  notifyIncorrect(): void {
    this.tryVibrate([70, 35, 70]);
    if (!this.audioMuted()) void this.playIncorrectSound();
  }

  notifyExplosion(step = 0): void {
    this.tryVibrate([55, 25, 85]);
    if (!this.audioMuted()) void this.playExplosionSound(step);
  }

  async notifyMineCountdown(): Promise<void> {
    this.tryVibrate([18, 180, 18, 180, 24]);
    if (!this.audioMuted()) {
      await this.playMineCountdownSound();
      return;
    }
    await this.wait(800);
  }

  notifyDefused(step = 0): void {
    this.tryVibrate([22, 18, 34]);
    if (!this.audioMuted()) void this.playDefusedSound(step);
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

  private async playCorrectSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) return;
    const now = context.currentTime;
    this.playTone(context, now, 520, 660, 0.16, 0.04, 'triangle');
    this.playTone(context, now + 0.09, 660, 840, 0.18, 0.04, 'triangle');
    this.playTone(context, now + 0.19, 840, 1040, 0.24, 0.035, 'sine');
  }

  private async playIncorrectSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) return;
    const now = context.currentTime;
    this.playTone(context, now, 260, 190, 0.2, 0.045, 'square');
    this.playTone(context, now + 0.13, 210, 145, 0.24, 0.035, 'sawtooth');
  }

  private async playExplosionSound(step: number): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const variation = Math.min(Math.max(step, 0), 8) * 7;
    this.playTone(context, now, 150 + variation, 48, 0.32, 0.055, 'sawtooth');
    this.playTone(context, now + 0.025, 95 + variation, 36, 0.38, 0.045, 'square');
  }

  private async playMineCountdownSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) {
      await this.wait(800);
      return;
    }
    const now = context.currentTime;
    // A small scheduling lead-in prevents Firefox from swallowing the first tone
    // while an AudioContext has just been resumed.
    this.playTone(context, now + 0.06, 720, 720, 0.11, 0.035, 'square');
    this.playTone(context, now + 0.34, 830, 830, 0.11, 0.04, 'square');
    this.playTone(context, now + 0.62, 980, 980, 0.12, 0.045, 'square');
    await this.wait(800);
  }

  private wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  private async playDefusedSound(step: number): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const base = 430 + Math.min(Math.max(step, 0), 8) * 28;
    this.playTone(context, now, base, base + 150, 0.18, 0.03, 'triangle');
    this.playTone(context, now + 0.075, base + 170, base + 260, 0.16, 0.022, 'sine');
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
