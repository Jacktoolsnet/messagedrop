import { Injectable, inject } from '@angular/core';
import { AppService } from './app.service';

@Injectable({
  providedIn: 'root'
})
export class PinInputFeedbackService {
  private audioContext: AudioContext | null = null;
  private readonly appService = inject(AppService);

  async notifyAcceptedInput(): Promise<void> {
    const feedbackSettings = this.appService.getAppSettings().pinInputFeedback;
    if (!feedbackSettings.hapticEnabled && !feedbackSettings.audioEnabled) {
      return;
    }

    const vibrated = feedbackSettings.hapticEnabled
      ? this.tryVibrate(this.getAcceptedVibrationPattern())
      : false;

    if (!feedbackSettings.audioEnabled) {
      return;
    }

    if (vibrated && !this.shouldPlayBeepAlongsideVibration()) {
      return;
    }

    await this.playSubtleBeep(this.getConfiguredAudioLevel(feedbackSettings.audioLevel));
  }

  async notifyResetAction(): Promise<void> {
    const feedbackSettings = this.appService.getAppSettings().pinInputFeedback;
    if (!feedbackSettings.hapticEnabled && !feedbackSettings.audioEnabled) {
      return;
    }

    const vibrated = feedbackSettings.hapticEnabled
      ? this.tryVibrate(this.getResetVibrationPattern())
      : false;

    if (!feedbackSettings.audioEnabled) {
      return;
    }

    if (vibrated && !this.shouldPlayBeepAlongsideVibration()) {
      return;
    }

    await this.playResetBeep(this.getConfiguredAudioLevel(feedbackSettings.audioLevel));
  }

  private tryVibrate(pattern: number | number[]): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return false;
    }

    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  private async playSubtleBeep(audioLevel: number): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) {
      return;
    }
    const now = context.currentTime;
    const fundamental = context.createOscillator();
    const undertone = context.createOscillator();
    const presence = context.createOscillator();
    const fundamentalGain = context.createGain();
    const undertoneGain = context.createGain();
    const presenceGain = context.createGain();
    const filter = context.createBiquadFilter();
    const masterGain = context.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(560, now);
    fundamental.frequency.exponentialRampToValueAtTime(470, now + 0.14);

    undertone.type = 'triangle';
    undertone.frequency.setValueAtTime(280, now);
    undertone.frequency.exponentialRampToValueAtTime(235, now + 0.14);

    presence.type = 'sine';
    presence.frequency.setValueAtTime(760, now);
    presence.frequency.exponentialRampToValueAtTime(620, now + 0.14);

    fundamentalGain.gain.setValueAtTime(0.0001, now);
    fundamentalGain.gain.linearRampToValueAtTime(0.024, now + 0.012);
    fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    undertoneGain.gain.setValueAtTime(0.0001, now);
    undertoneGain.gain.linearRampToValueAtTime(0.013, now + 0.018);
    undertoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    presenceGain.gain.setValueAtTime(0.0001, now);
    presenceGain.gain.linearRampToValueAtTime(0.006, now + 0.01);
    presenceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(0.45, now);

    masterGain.gain.setValueAtTime(0.95 * audioLevel, now);

    fundamental.connect(fundamentalGain);
    undertone.connect(undertoneGain);
    presence.connect(presenceGain);
    fundamentalGain.connect(filter);
    undertoneGain.connect(filter);
    presenceGain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(context.destination);

    fundamental.start(now);
    undertone.start(now);
    presence.start(now);
    fundamental.stop(now + 0.16);
    undertone.stop(now + 0.16);
    presence.stop(now + 0.14);
    fundamental.addEventListener('ended', () => {
      fundamental.disconnect();
      undertone.disconnect();
      presence.disconnect();
      fundamentalGain.disconnect();
      undertoneGain.disconnect();
      presenceGain.disconnect();
      filter.disconnect();
      masterGain.disconnect();
    }, { once: true });
  }

  private async playResetBeep(audioLevel: number): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const fundamental = context.createOscillator();
    const undertone = context.createOscillator();
    const presence = context.createOscillator();
    const pulseGain = context.createGain();
    const bodyGain = context.createGain();
    const presenceGain = context.createGain();
    const filter = context.createBiquadFilter();
    const masterGain = context.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(460, now);
    fundamental.frequency.exponentialRampToValueAtTime(350, now + 0.22);

    undertone.type = 'triangle';
    undertone.frequency.setValueAtTime(230, now);
    undertone.frequency.exponentialRampToValueAtTime(175, now + 0.24);

    presence.type = 'sine';
    presence.frequency.setValueAtTime(680, now);
    presence.frequency.exponentialRampToValueAtTime(540, now + 0.22);

    pulseGain.gain.setValueAtTime(0.0001, now);
    pulseGain.gain.linearRampToValueAtTime(0.034, now + 0.014);
    pulseGain.gain.exponentialRampToValueAtTime(0.006, now + 0.10);
    pulseGain.gain.linearRampToValueAtTime(0.028, now + 0.145);
    pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(0.019, now + 0.02);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    presenceGain.gain.setValueAtTime(0.0001, now);
    presenceGain.gain.linearRampToValueAtTime(0.007, now + 0.012);
    presenceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(960, now);
    filter.Q.setValueAtTime(0.5, now);

    masterGain.gain.setValueAtTime(1.0 * audioLevel, now);

    fundamental.connect(pulseGain);
    undertone.connect(bodyGain);
    presence.connect(presenceGain);
    pulseGain.connect(filter);
    bodyGain.connect(filter);
    presenceGain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(context.destination);

    fundamental.start(now);
    undertone.start(now);
    presence.start(now);
    fundamental.stop(now + 0.28);
    undertone.stop(now + 0.28);
    presence.stop(now + 0.24);
    fundamental.addEventListener('ended', () => {
      fundamental.disconnect();
      undertone.disconnect();
      presence.disconnect();
      pulseGain.disconnect();
      bodyGain.disconnect();
      presenceGain.disconnect();
      filter.disconnect();
      masterGain.disconnect();
    }, { once: true });
  }

  private getAudioContextConstructor(): typeof AudioContext | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  }

  private shouldPlayBeepAlongsideVibration(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    return /Android|CrOS/i.test(navigator.userAgent);
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

  private getAcceptedVibrationPattern(): number | number[] {
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      return [24, 14, 18];
    }

    return 18;
  }

  private getResetVibrationPattern(): number | number[] {
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      return [38, 24, 34];
    }

    return [26, 18, 24];
  }

  private getConfiguredAudioLevel(level: number | undefined): number {
    if (typeof level !== 'number' || !Number.isFinite(level)) {
      return 1;
    }

    return Math.min(1.6, Math.max(0.4, level));
  }
}
