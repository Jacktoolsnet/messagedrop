import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameFeedbackService {
  private readonly audioMutedStorageKey = 'messagedrop.gameFeedback.audioMuted';
  private readonly arcadeMusicMutedStorageKey = 'messagedrop.gameFeedback.arcadeMusicMuted';
  private audioContext: AudioContext | null = null;
  private lastHoverSoundAt = 0;
  private readonly arcadeMusicOwners = new Set<object>();
  private arcadeMusicTimer: number | null = null;
  private arcadeMusicStarting = false;
  private arcadeMusicStep = 0;
  readonly audioMuted = signal(this.readAudioMuted());
  readonly arcadeMusicMuted = signal(this.readBoolean(this.arcadeMusicMutedStorageKey));

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

  notifyUnlock(): void {
    this.tryVibrate([22, 35, 42]);
    if (!this.audioMuted()) void this.playUnlockSound();
  }

  notifyIncorrect(): void {
    this.tryVibrate([70, 35, 70]);
    if (!this.audioMuted()) void this.playIncorrectSound();
  }

  notifyExplosion(step = 0): void {
    this.tryVibrate([55, 25, 85]);
    if (!this.audioMuted()) void this.playExplosionSound(step);
  }

  notifyLaserHit(): void {
    this.tryVibrate([45, 25, 70]);
    if (!this.audioMuted()) void this.playLaserHitSound();
  }

  notifyShipDestroyed(): void {
    this.tryVibrate([70, 30, 110, 35, 150]);
    if (!this.audioMuted()) void this.playShipDestroyedSound();
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
    void this.syncArcadeMusic();
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(this.audioMutedStorageKey, String(muted));
    } catch {
      // Persisting the optional preference may be blocked by the browser.
    }
  }

  registerArcadeMusic(owner: object): void {
    this.arcadeMusicOwners.add(owner);
    void this.syncArcadeMusic();
  }

  unregisterArcadeMusic(owner: object): void {
    this.arcadeMusicOwners.delete(owner);
    void this.syncArcadeMusic();
  }

  toggleArcadeMusicMuted(): void {
    const muted = !this.arcadeMusicMuted();
    this.arcadeMusicMuted.set(muted);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(this.arcadeMusicMutedStorageKey, String(muted)); } catch { /* Optional preference. */ }
    }
    void this.syncArcadeMusic();
  }

  private async syncArcadeMusic(): Promise<void> {
    const shouldPlay = this.arcadeMusicOwners.size > 0 && !this.arcadeMusicMuted() && !this.audioMuted();
    if (!shouldPlay) { this.stopArcadeMusic(); return; }
    if (this.arcadeMusicTimer !== null || this.arcadeMusicStarting) return;
    this.arcadeMusicStarting = true;
    try {
      const context = await this.getReadyAudioContext();
      if (!context || this.arcadeMusicOwners.size === 0 || this.arcadeMusicMuted() || this.audioMuted()) return;
      this.arcadeMusicStep = 0;
      this.playArcadeMusicStep(context);
      this.arcadeMusicTimer = window.setInterval(() => this.playArcadeMusicStep(context), 285);
    } finally {
      this.arcadeMusicStarting = false;
    }
  }

  private stopArcadeMusic(): void {
    if (this.arcadeMusicTimer === null) return;
    window.clearInterval(this.arcadeMusicTimer);
    this.arcadeMusicTimer = null;
  }

  private playArcadeMusicStep(context: AudioContext): void {
    if (context.state !== 'running') return;
    const step = this.arcadeMusicStep++;
    const sequenceStep = step % 64;
    const bar = Math.floor(sequenceStep / 8);
    const beat = sequenceStep % 8;
    const cycle = Math.floor(step / 64);
    const roots = [45, 41, 43, 40, 45, 48, 43, 40];
    const minorBars = new Set([0, 3, 4, 7]);
    const arpeggioPattern = [0, 2, 1, 2, 0, 2, 1, 3];
    const chord = minorBars.has(bar) ? [0, 3, 7, 12] : [0, 4, 7, 12];
    const leadPatterns:Array<Array<number|null>> = [
      [12, null, 15, 19, 17, null, 15, null],
      [12, 16, 19, null, 21, 19, 16, null],
      [14, null, 19, 21, 19, 16, 14, null],
      [12, 15, 19, null, 22, null, 19, 15],
      [12, null, 19, 24, 22, 19, 15, null],
      [12, 16, 19, 24, null, 21, 19, 16],
      [14, 19, 21, null, 26, 21, 19, null],
      [19, 15, 12, null, 10, 12, 15, null]
    ];
    const now = context.currentTime + .015;
    const root = roots[bar];

    // A quiet arpeggio keeps the soundtrack moving without the old short-loop effect.
    if (beat !== 7 || cycle % 2 === 0) {
      const note = root + 12 + chord[arpeggioPattern[beat]];
      const frequency = this.midiFrequency(note);
      this.playTone(context, now, frequency, frequency * 1.006, .2, .0045, 'triangle');
    }

    // The lead spans eight different bars. Every second pass adds small octave answers.
    const leadInterval = leadPatterns[bar][beat];
    if (leadInterval !== null) {
      const octaveAnswer = cycle % 2 === 1 && (beat === 3 || beat === 6) ? 12 : 0;
      const frequency = this.midiFrequency(root + leadInterval + octaveAnswer);
      this.playTone(context, now + .025, frequency, frequency * (beat % 2 ? .995 : 1.008), .24, .0065, 'square');
    }

    // Bass pulses and a tiny high-score sparkle give the eight bars more structure.
    if (beat === 0 || beat === 4) {
      const bass = this.midiFrequency(root - 12);
      this.playTone(context, now, bass, bass * 1.03, beat === 0 ? .42 : .28, .007, 'triangle');
      this.playTone(context, now, 92, 48, .12, .0035, 'sine');
    }
    if (beat === 7 && (bar === 3 || bar === 7)) {
      const sparkle = this.midiFrequency(root + 31 + (cycle % 2 ? 2 : 0));
      this.playTone(context, now + .035, sparkle, sparkle * 1.12, .26, .0035, 'sine');
    }
  }

  private midiFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
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

  private async playUnlockSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) return;
    const now = context.currentTime;
    this.playTone(context, now, 170, 245, .1, .045, 'square');
    this.playTone(context, now + .1, 390, 720, .24, .035, 'triangle');
    this.playTone(context, now + .2, 720, 930, .18, .025, 'sine');
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

  private async playLaserHitSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) return;
    const now = context.currentTime;
    this.playTone(context, now, 980, 310, .2, .045, 'sawtooth');
    this.playTone(context, now + .055, 420, 135, .28, .04, 'square');
  }

  private async playShipDestroyedSound(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) return;
    const now = context.currentTime;
    this.playTone(context, now, 1100, 240, .22, .045, 'sawtooth');
    this.playTone(context, now + .12, 230, 42, .55, .065, 'sawtooth');
    this.playTone(context, now + .2, 145, 34, .68, .055, 'square');
    this.playTone(context, now + .42, 92, 28, .62, .04, 'triangle');
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
    return this.readBoolean(this.audioMutedStorageKey);
  }

  private readBoolean(key: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    try { return localStorage.getItem(key) === 'true'; } catch { return false; }
  }
}
