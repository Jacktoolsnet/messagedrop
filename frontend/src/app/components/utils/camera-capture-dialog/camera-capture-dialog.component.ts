import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';

@Component({
  selector: 'app-camera-capture-dialog',
  standalone: true,
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './camera-capture-dialog.component.html',
  styleUrl: './camera-capture-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CameraCaptureDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<CameraCaptureDialogComponent>);
  private stream?: MediaStream;

  @ViewChild('video', { static: true }) private readonly video!: ElementRef<HTMLVideoElement>;

  readonly ready = signal(false);
  readonly failed = signal(false);

  ngAfterViewInit(): void {
    void this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  close(): void {
    this.dialogRef.close();
  }

  capture(): void {
    const video = this.video.nativeElement;
    if (!this.ready() || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      this.dialogRef.close(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  }

  private async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      const video = this.video.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.ready.set(true);
    } catch {
      this.failed.set(true);
      this.stopCamera();
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
    if (this.video?.nativeElement) this.video.nativeElement.srcObject = null;
  }
}
