import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

interface AudioPayload {
  base64: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
}

interface AudioRecorderDialogData {
  initialAudio?: AudioPayload | null;
  maxBase64Bytes?: number;
}

const DEFAULT_MAX_BASE64_BYTES = 1_000_000;

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
  private readonly dialogRef = inject(MatDialogRef<AudioRecorderComponent>);
  private readonly destroyRef = inject(DestroyRef);
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

  audioPayload?: AudioPayload;

  constructor() {
    if (this.data.initialAudio) {
      this.setAudioPayload(this.data.initialAudio);
    }

    this.destroyRef.onDestroy(() => {
      this.stopStream();
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
      this.recording = true;

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
  }

  togglePlayback(): void {
    if (!this.audioUrl) {
      return;
    }
    if (!this.audioPlayer) {
      this.audioPlayer = new Audio(this.audioUrl);
      this.audioPlayer.addEventListener('ended', () => {
        this.audioPlayer?.pause();
      });
    }
    if (this.audioPlayer.paused) {
      void this.audioPlayer.play();
    } else {
      this.audioPlayer.pause();
    }
  }

  isPlaying(): boolean {
    return !!this.audioPlayer && !this.audioPlayer.paused;
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

  private createAudioPayload(base64: string, mimeType: string, sizeBytes: number, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    this.cleanupAudioUrl();
    this.audioUrl = url;
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      const durationMs = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
      const payload: AudioPayload = {
        base64,
        mimeType,
        sizeBytes,
        durationMs
      };
      this.setAudioPayload(payload);
    });
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

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
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
