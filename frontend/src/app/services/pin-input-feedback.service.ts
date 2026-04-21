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

    await this.playSubtleBeep();
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

    await this.playResetBeep();
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

  private async playSubtleBeep(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) {
      return;
    }
    const now = context.currentTime;
    const fundamental = context.createOscillator();
    const undertone = context.createOscillator();
    const fundamentalGain = context.createGain();
    const undertoneGain = context.createGain();
    const filter = context.createBiquadFilter();
    const masterGain = context.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(520, now);
    fundamental.frequency.exponentialRampToValueAtTime(440, now + 0.14);

    undertone.type = 'triangle';
    undertone.frequency.setValueAtTime(260, now);
    undertone.frequency.exponentialRampToValueAtTime(220, now + 0.14);

    fundamentalGain.gain.setValueAtTime(0.0001, now);
    fundamentalGain.gain.linearRampToValueAtTime(0.018, now + 0.012);
    fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    undertoneGain.gain.setValueAtTime(0.0001, now);
    undertoneGain.gain.linearRampToValueAtTime(0.010, now + 0.018);
    undertoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.setValueAtTime(0.4, now);

    masterGain.gain.setValueAtTime(0.85, now);

    fundamental.connect(fundamentalGain);
    undertone.connect(undertoneGain);
    fundamentalGain.connect(filter);
    undertoneGain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(context.destination);

    fundamental.start(now);
    undertone.start(now);
    fundamental.stop(now + 0.16);
    undertone.stop(now + 0.16);
    fundamental.addEventListener('ended', () => {
      fundamental.disconnect();
      undertone.disconnect();
      fundamentalGain.disconnect();
      undertoneGain.disconnect();
      filter.disconnect();
      masterGain.disconnect();
    }, { once: true });
  }

  private async playResetBeep(): Promise<void> {
    const context = await this.getReadyAudioContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const fundamental = context.createOscillator();
    const undertone = context.createOscillator();
    const pulseGain = context.createGain();
    const bodyGain = context.createGain();
    const filter = context.createBiquadFilter();
    const masterGain = context.createGain();

    fundamental.type = 'sine';
    fundamental.frequency.setValueAtTime(420, now);
    fundamental.frequency.exponentialRampToValueAtTime(320, now + 0.22);

    undertone.type = 'triangle';
    undertone.frequency.setValueAtTime(210, now);
    undertone.frequency.exponentialRampToValueAtTime(160, now + 0.24);

    pulseGain.gain.setValueAtTime(0.0001, now);
    pulseGain.gain.linearRampToValueAtTime(0.028, now + 0.014);
    pulseGain.gain.exponentialRampToValueAtTime(0.005, now + 0.10);
    pulseGain.gain.linearRampToValueAtTime(0.024, now + 0.145);
    pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(0.016, now + 0.02);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(720, now);
    filter.Q.setValueAtTime(0.55, now);

    masterGain.gain.setValueAtTime(0.95, now);

    fundamental.connect(pulseGain);
    undertone.connect(bodyGain);
    pulseGain.connect(filter);
    bodyGain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(context.destination);

    fundamental.start(now);
    undertone.start(now);
    fundamental.stop(now + 0.28);
    undertone.stop(now + 0.28);
    fundamental.addEventListener('ended', () => {
      fundamental.disconnect();
      undertone.disconnect();
      pulseGain.disconnect();
      bodyGain.disconnect();
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
}
