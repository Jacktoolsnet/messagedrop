import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PinInputFeedbackService {
  private audioContext: AudioContext | null = null;

  async notifyAcceptedInput(): Promise<void> {
    const vibrated = this.tryVibrate();
    if (vibrated && !this.shouldAlsoPlayBeep()) {
      return;
    }

    await this.playSubtleBeep();
  }

  private tryVibrate(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return false;
    }

    try {
      return navigator.vibrate(12);
    } catch {
      return false;
    }
  }

  private async playSubtleBeep(): Promise<void> {
    const AudioContextCtor = this.getAudioContextConstructor();
    if (!AudioContextCtor) {
      return;
    }

    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContextCtor();
    }

    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        return;
      }
    }

    const context = this.audioContext;
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

  private getAudioContextConstructor(): typeof AudioContext | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  }

  private shouldAlsoPlayBeep(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    return /CrOS/i.test(navigator.userAgent);
  }
}
