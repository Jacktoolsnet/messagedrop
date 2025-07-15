import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Result } from '@zxing/library';
import { Mode } from '../../../interfaces/mode';

@Component({
  selector: 'app-scanner',
  imports: [
    MatDialogContent,
    MatButtonModule,
    MatDialogTitle,
    MatDialogActions,
    MatDialogClose,
  ],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.css'
})
export class ScannerComponent implements AfterViewInit, OnDestroy {

  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;

  private controls: IScannerControls | null = null;
  private codeReader = new BrowserMultiFormatReader();
  private scanning = false;

  constructor(
    public dialogRef: MatDialogRef<ScannerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, connectId: string }
  ) { }

  ngAfterViewInit(): void {
    this.codeReader.decodeFromVideoDevice(
      undefined,
      this.videoRef.nativeElement,
      (result: Result | undefined, error: any, controls) => {
        this.controls = controls;

        if (result) {
          this.onCodeResult(result.getText());
          controls.stop(); // direkt hier oder im destroy
        } else if (error) {
          this.onScanFailure();
        }
      }
    ).catch(err => {
      this.onScanError(err);
    });
  }

  ngOnDestroy(): void {
    if (this.controls) {
      this.controls.stop();
    }
  }

  onCodeResult(resultString: string) {
    if (this.data.mode === 'add_connect') {
      this.data.connectId = resultString;
    }
    this.dialogRef.close(this.data);
  }

  onScanFailure() {
    // optional: visuelles Feedback
  }

  onScanError(err: any) {
    console.error('Scan error:', err);
  }
}
