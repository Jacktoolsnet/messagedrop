import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

interface AudioPayload {
  base64: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  waveform?: number[];
}

interface AudioRecorderDialogData {
  initialAudio?: AudioPayload | null;
  maxBase64Bytes?: number;
}

interface AudioWaveBar {
  value: number;
  active: boolean;
}

const DEFAULT_MAX_BASE64_BYTES = 1_500_000;

@Component({
  selector: 'app-audio-recorder',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './audio-recorder.component.html',
  styleUrl: './audio-recorder.component.css'
})
export class AudioRecorderComponent {
  readonly Math = Math;
  private readonly dialogRef = inject(MatDialogRef<AudioRecorderComponent>);
  private readonly destroyRef = inject(DestroyRef);
  readonly help = inject(HelpDialogService);
  readonly data = inject<AudioRecorderDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly maxBase64Bytes = this.data.maxBase64Bytes ?? DEFAULT_MAX_BASE64_BYTES;

  recording = false;
  hasAudio = false;
  isTooLarge = false;
  errorMessage = '';

  private mediaRecorder?: MediaRecorder;
  private chunks: BlobPart[] = [];
  private audioUrl?: string;
  private audioPlayer?: HTMLAudioElement;
  private playbackTimer?: ReturnType<typeof setInterval>;
  private playbackProgress = 0;
  private playbackStartedAt = 0;
  private playbackStartedOffset = 0;
  playbackActive = false;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private analyserData?: Uint8Array<ArrayBuffer>;
  private analyserTimer?: ReturnType<typeof setInterval>;
  private peakSamples: number[] = [];
  private recordedBytes = 0;
  private recordingStartedAt = 0;
  recordingRemainingSeconds: number | null = null;
  private readonly liveBars = 60;
  private livePeaks: number[] = [];
  private readonly stopAtRatio = 0.92;
  private readonly clearedWaveValue = 0.08;

  audioPayload?: AudioPayload;
  liveWaveform: number[] = [];

  constructor() {
    if (this.data.initialAudio) {
      this.setAudioPayload(this.data.initialAudio);
    }

    this.destroyRef.onDestroy(() => {
      this.stopStream();
      this.stopAnalyser();
      this.cleanupAudioUrl();
      this.audioPlayer?.pause();
    });
  }

  async startRecording(): Promise<void> {
    this.errorMessage = '';
    this.isTooLarge = false;
    this.audioPayload = undefined;
    this.hasAudio = false;
    this.livePeaks = Array(this.liveBars).fill(0);
    this.liveWaveform = Array(this.liveBars).fill(0.2);
    this.recordedBytes = 0;
    this.recordingStartedAt = performance.now();
    this.recordingRemainingSeconds = null;
    this.cleanupAudioUrl();

    if (!('mediaDevices' in navigator)) {
      this.errorMessage = 'common.audioRecorder.notSupported';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.peakSamples = [];
      this.recording = true;
      this.startAnalyser(stream);

      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data?.size) {
          this.chunks.push(event.data);
          this.recordedBytes += event.data.size;
          const estimatedBase64Size = Math.ceil(this.recordedBytes / 3) * 4;
          const softLimit = Math.floor(this.maxBase64Bytes * this.stopAtRatio);
          this.updateRemainingEstimate(estimatedBase64Size, softLimit);
          if (estimatedBase64Size >= softLimit) {
            this.stopRecording();
          }
        }
      });

      this.mediaRecorder.addEventListener('stop', () => {
        this.finalizeRecording();
      });

      this.mediaRecorder.start(400);
    } catch {
      this.errorMessage = 'common.audioRecorder.permissionDenied';
      this.recording = false;
      this.stopStream();
    }
  }

  toggleRecording(): void {
    if (this.recording) {
      this.stopRecording();
      return;
    }
    void this.startRecording();
  }

  stopRecording(): void {
    if (!this.mediaRecorder) {
      return;
    }
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.recording = false;
    this.recordingRemainingSeconds = null;
    this.stopAnalyser();
  }

  togglePlayback(): void {
    if (!this.audioUrl) {
      return;
    }
    if (!this.audioPlayer) {
      this.audioPlayer = new Audio(this.audioUrl);
      this.audioPlayer.addEventListener('ended', () => {
        this.audioPlayer?.pause();
        this.stopPlaybackProgress();
        this.playbackProgress = 0;
        this.playbackActive = false;
      });
    }
    if (this.audioPlayer.paused) {
      const fallbackDuration = (this.audioPayload?.durationMs ?? 0) / 1000;
      const duration = Number.isFinite(this.audioPlayer.duration) && this.audioPlayer.duration > 0
        ? this.audioPlayer.duration
        : fallbackDuration;
      const atEnd = Number.isFinite(duration) && duration > 0
        ? (this.audioPlayer.currentTime >= duration - 0.05)
        : (this.playbackProgress >= 1);
      if (this.audioPlayer.ended || atEnd) {
        this.audioPlayer.currentTime = 0;
        this.playbackProgress = 0;
      }
      this.playbackActive = true;
      this.playbackStartedAt = performance.now();
      this.playbackStartedOffset = this.audioPlayer.currentTime || 0;
      this.playbackProgress = 0.001;
      void this.audioPlayer.play();
      this.startPlaybackProgress();
    } else {
      this.audioPlayer.pause();
      this.stopPlaybackProgress();
      this.playbackActive = false;
    }
  }

  isPlaying(): boolean {
    return !!this.audioPlayer && !this.audioPlayer.paused;
  }

  getPlaybackBars(): AudioWaveBar[] {
    const waveform = this.audioPayload?.waveform ?? [];
    const totalBars = waveform.length;
    if (!totalBars) {
      return [];
    }
    const useScroll = !!this.audioPlayer && (this.playbackProgress > 0 || this.isPlaying());
    if (!useScroll) {
      const startIndex = Math.max(0, totalBars - this.liveBars);
      const bars: AudioWaveBar[] = [];
      for (let i = 0; i < this.liveBars; i += 1) {
        const sourceIndex = startIndex + i;
        const value = waveform[sourceIndex] ?? 0.2;
        bars.push({ value, active: false });
      }
      return bars;
    }
    const currentIndex = Math.min(totalBars - 1, Math.floor(this.playbackProgress * totalBars));
    const bars: AudioWaveBar[] = [];
    for (let i = 0; i < this.liveBars; i += 1) {
      const offset = this.liveBars - 1 - i;
      const sourceIndex = currentIndex - offset;
      if (sourceIndex < 0 || sourceIndex >= totalBars) {
        bars.push({ value: this.clearedWaveValue, active: false });
        continue;
      }
      const value = waveform[sourceIndex] ?? 0.2;
      bars.push({ value, active: sourceIndex === currentIndex && currentIndex >= 0 });
    }
    return bars;
  }

  resetAudio(): void {
    this.audioPayload = undefined;
    this.hasAudio = false;
    this.isTooLarge = false;
    this.errorMessage = '';
    this.liveWaveform = [];
    this.livePeaks = [];
    this.recordingRemainingSeconds = null;
    this.cleanupAudioUrl();
  }

  send(): void {
    if (!this.audioPayload || this.isTooLarge) {
      return;
    }
    this.dialogRef.close({ audio: this.audioPayload });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  openHelp(): void {
    this.help.open('contactChatroom');
  }

  private finalizeRecording(): void {
    this.stopStream();
    const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mimeType });
    if (!blob.size) {
      return;
    }
    const sizeBytes = blob.size;
    const measuredDurationMs = Math.max(0, Math.round(performance.now() - this.recordingStartedAt));
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      if (base64.length > this.maxBase64Bytes) {
        this.isTooLarge = true;
        this.errorMessage = 'common.audioRecorder.tooLarge';
        return;
      }
      this.createAudioPayload(base64, mimeType, sizeBytes, blob, measuredDurationMs);
    };
    reader.readAsDataURL(blob);
  }

  private async createAudioPayload(
    base64: string,
    mimeType: string,
    sizeBytes: number,
    blob: Blob,
    measuredDurationMs: number
  ): Promise<void> {
    const url = URL.createObjectURL(blob);
    this.cleanupAudioUrl();
    this.audioUrl = url;
    let durationMs = measuredDurationMs;
    if (!durationMs) {
      durationMs = await this.computeDurationMs(blob);
    }
    let waveform = this.buildWaveformFromPeaks();
    if (!waveform?.length) {
      waveform = await this.buildWaveform(blob);
    }
    const payload: AudioPayload = {
      base64,
      mimeType,
      sizeBytes,
      durationMs,
      waveform: waveform ?? undefined
    };
    this.setAudioPayload(payload);
  }

  private startPlaybackProgress(): void {
    this.stopPlaybackProgress();
    this.playbackTimer = setInterval(() => {
      if (!this.audioPlayer) {
        return;
      }
      const fallbackDuration = (this.audioPayload?.durationMs ?? 0) / 1000;
      const duration = Number.isFinite(this.audioPlayer.duration) && this.audioPlayer.duration > 0
        ? this.audioPlayer.duration
        : fallbackDuration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      const elapsed = (performance.now() - this.playbackStartedAt) / 1000 + this.playbackStartedOffset;
      const currentTime = this.audioPlayer.currentTime || 0;
      const effectiveTime = Math.max(currentTime, elapsed);
      this.playbackProgress = Math.min(1, Math.max(0, effectiveTime / duration));
    }, 120);
  }

  private stopPlaybackProgress(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }
  }

  private setAudioPayload(payload: AudioPayload): void {
    this.audioPayload = payload;
    this.hasAudio = true;
    this.isTooLarge = false;
    this.errorMessage = '';
    this.liveWaveform = [];
    this.livePeaks = [];
    if (!this.audioUrl) {
      const blob = this.base64ToBlob(payload.base64, payload.mimeType);
      this.audioUrl = URL.createObjectURL(blob);
    }
  }

  private getSupportedMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/webm',
      'audio/ogg'
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  waveHeight(value: number): number {
    if (!Number.isFinite(value)) {
      return 20;
    }
    return Math.max(20, Math.round(value * 100));
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  private startAnalyser(stream: MediaStream): void {
    try {
      this.audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      this.analyserData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
      this.analyserTimer = setInterval(() => {
        if (!this.analyser || !this.analyserData) {
          return;
        }
        this.analyser.getByteTimeDomainData(this.analyserData);
        let peak = 0;
        for (const sample of this.analyserData) {
          const normalized = Math.abs((sample - 128) / 128);
          if (normalized > peak) {
            peak = normalized;
          }
        }
        this.peakSamples.push(peak);
        this.updateLiveWaveform(peak);
      }, 120);
    } catch {
      this.stopAnalyser();
    }
  }

  private stopAnalyser(): void {
    if (this.analyserTimer) {
      clearInterval(this.analyserTimer);
      this.analyserTimer = undefined;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => undefined);
      this.audioContext = undefined;
    }
    this.analyser = undefined;
    this.analyserData = undefined;
  }

  private updateLiveWaveform(peak: number): void {
    if (this.livePeaks.length < this.liveBars) {
      this.livePeaks.push(peak);
    } else {
      this.livePeaks.shift();
      this.livePeaks.push(peak);
    }
    let maxPeak = 0;
    for (const peakValue of this.livePeaks) {
      if (peakValue > maxPeak) {
        maxPeak = peakValue;
      }
    }
    const safeMax = maxPeak > 0.001 ? maxPeak : 0.001;
    this.liveWaveform = this.livePeaks.map((value) => this.normalizeWaveValue(value, safeMax));
  }

  private buildWaveformFromPeaks(): number[] | null {
    if (!this.peakSamples.length) {
      return null;
    }
    const bars = this.liveBars;
    const blockSize = Math.max(1, Math.floor(this.peakSamples.length / bars));
    const waveform: number[] = [];
    let maxPeak = 0;
    for (const samplePeak of this.peakSamples) {
      if (samplePeak > maxPeak) {
        maxPeak = samplePeak;
      }
    }
    for (let i = 0; i < bars; i += 1) {
      const start = i * blockSize;
      let peak = 0;
      for (let j = 0; j < blockSize; j += 1) {
        const value = this.peakSamples[start + j] ?? 0;
        if (value > peak) {
          peak = value;
        }
      }
      waveform.push(this.normalizeWaveValue(peak, maxPeak));
    }
    return waveform;
  }

  private async buildWaveform(blob: Blob): Promise<number[]> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channel = decoded.getChannelData(0);
      const bars = this.liveBars;
      const blockSize = Math.max(1, Math.floor(channel.length / bars));
      const waveform: number[] = [];
      let maxPeak = 0;
      for (const sample of channel) {
        const value = Math.abs(sample ?? 0);
        if (value > maxPeak) {
          maxPeak = value;
        }
      }
      for (let i = 0; i < bars; i += 1) {
        const start = i * blockSize;
        let peak = 0;
        for (let j = 0; j < blockSize; j += 1) {
          const value = Math.abs(channel[start + j] ?? 0);
          if (value > peak) {
            peak = value;
          }
        }
        waveform.push(this.normalizeWaveValue(peak, maxPeak));
      }
      await audioContext.close();
      return waveform;
    } catch {
      return [];
    }
  }

  private normalizeWaveValue(value: number, maxPeak: number): number {
    if (!Number.isFinite(value) || !Number.isFinite(maxPeak) || maxPeak <= 0.001) {
      return 0.3;
    }
    const normalized = Math.min(1, value / maxPeak);
    const boosted = Math.pow(normalized, 0.6);
    return 0.2 + boosted * 0.8;
  }

  private async computeDurationMs(blob: Blob): Promise<number> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const durationMs = Number.isFinite(decoded.duration) ? Math.round(decoded.duration * 1000) : 0;
      await audioContext.close();
      return durationMs;
    } catch {
      return 0;
    }
  }

  remainingLabel(): string {
    if (this.recordingRemainingSeconds === null) {
      return '--:--';
    }
    const minutes = Math.floor(this.recordingRemainingSeconds / 60);
    const seconds = this.recordingRemainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  playbackLabel(): string {
    const totalSeconds = this.getPlaybackDurationSeconds();
    if (!totalSeconds) {
      return '--:--';
    }
    const elapsedSeconds = Math.min(totalSeconds, Math.round(totalSeconds * this.playbackProgress));
    return `${this.formatSeconds(elapsedSeconds)} / ${this.formatSeconds(totalSeconds)}`;
  }

  private formatSeconds(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private getPlaybackDurationSeconds(): number | null {
    const playerDuration = this.audioPlayer?.duration;
    if (Number.isFinite(playerDuration) && (playerDuration ?? 0) > 0) {
      return Math.round(playerDuration as number);
    }
    if (this.audioPayload?.durationMs && this.audioPayload.durationMs > 0) {
      return Math.round(this.audioPayload.durationMs / 1000);
    }
    return null;
  }

  private updateRemainingEstimate(estimatedBase64Size: number, softLimit: number): void {
    const elapsedMs = performance.now() - this.recordingStartedAt;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 600) {
      return;
    }
    const bytesPerMs = estimatedBase64Size / elapsedMs;
    if (!Number.isFinite(bytesPerMs) || bytesPerMs <= 0) {
      return;
    }
    const remainingBytes = Math.max(0, softLimit - estimatedBase64Size);
    const remainingMs = remainingBytes / bytesPerMs;
    this.recordingRemainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  }

  private stopStream(): void {
    const stream = this.mediaRecorder?.stream;
    stream?.getTracks().forEach((track) => track.stop());
  }

  private cleanupAudioUrl(): void {
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = undefined;
    }
  }
}
