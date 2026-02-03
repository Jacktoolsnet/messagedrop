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
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private analyserData?: Uint8Array<ArrayBuffer>;
  private analyserTimer?: ReturnType<typeof setInterval>;
  private peakSamples: number[] = [];

  audioPayload?: AudioPayload;

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
          const sizeBytes = this.chunks.reduce((acc, part) => acc + (part as Blob).size, 0);
          const estimatedBase64Size = Math.ceil(sizeBytes / 3) * 4;
          if (estimatedBase64Size > this.maxBase64Bytes) {
            this.isTooLarge = true;
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
      });
    }
    if (this.audioPlayer.paused) {
      void this.audioPlayer.play();
      this.startPlaybackProgress();
    } else {
      this.audioPlayer.pause();
      this.stopPlaybackProgress();
    }
  }

  isPlaying(): boolean {
    return !!this.audioPlayer && !this.audioPlayer.paused;
  }

  isAudioBarActive(index: number): boolean {
    const totalBars = this.audioPayload?.waveform?.length ?? 0;
    if (!totalBars) {
      return false;
    }
    const activeIndex = Math.floor(this.playbackProgress * totalBars);
    return index <= activeIndex;
  }

  resetAudio(): void {
    this.audioPayload = undefined;
    this.hasAudio = false;
    this.isTooLarge = false;
    this.errorMessage = '';
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
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      if (base64.length > this.maxBase64Bytes) {
        this.isTooLarge = true;
        this.errorMessage = 'common.audioRecorder.tooLarge';
        return;
      }
      this.createAudioPayload(base64, mimeType, sizeBytes, blob);
    };
    reader.readAsDataURL(blob);
  }

  private async createAudioPayload(base64: string, mimeType: string, sizeBytes: number, blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    this.cleanupAudioUrl();
    this.audioUrl = url;
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', async () => {
      const durationMs = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
      const waveform = this.buildWaveformFromPeaks() || await this.buildWaveform(blob);
      const payload: AudioPayload = {
        base64,
        mimeType,
        sizeBytes,
        durationMs,
        waveform
      };
      this.setAudioPayload(payload);
    });
  }

  private startPlaybackProgress(): void {
    this.stopPlaybackProgress();
    this.playbackTimer = setInterval(() => {
      if (!this.audioPlayer) {
        return;
      }
      const duration = this.audioPlayer.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      this.playbackProgress = Math.min(1, Math.max(0, this.audioPlayer.currentTime / duration));
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
        for (let i = 0; i < this.analyserData.length; i += 1) {
          const normalized = Math.abs((this.analyserData[i] - 128) / 128);
          if (normalized > peak) {
            peak = normalized;
          }
        }
        this.peakSamples.push(peak);
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

  private buildWaveformFromPeaks(): number[] | null {
    if (!this.peakSamples.length) {
      return null;
    }
    const bars = 60;
    const blockSize = Math.max(1, Math.floor(this.peakSamples.length / bars));
    const waveform: number[] = [];
    let maxPeak = 0;
    for (let i = 0; i < this.peakSamples.length; i += 1) {
      if (this.peakSamples[i] > maxPeak) {
        maxPeak = this.peakSamples[i];
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
      const bars = 60;
      const blockSize = Math.max(1, Math.floor(channel.length / bars));
      const waveform: number[] = [];
      let maxPeak = 0;
      for (let i = 0; i < channel.length; i += 1) {
        const value = Math.abs(channel[i] ?? 0);
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
