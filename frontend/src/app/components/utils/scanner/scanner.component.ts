import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Result } from '@zxing/library';
import { Mode } from '../../../interfaces/mode';
import { HelpDialogService } from '../help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';

@Component({
  selector: 'app-scanner',
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    TranslocoPipe,
    MatIcon
  ],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.css'
})
export class ScannerComponent implements AfterViewInit, OnDestroy {

  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;

  private controls: IScannerControls | null = null;
  private codeReader = new BrowserMultiFormatReader();

  readonly dialogRef = inject(MatDialogRef<ScannerComponent>);
  readonly data = inject<{ mode: Mode; connectId: string }>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);

  ngAfterViewInit(): void {
    this.codeReader.decodeFromVideoDevice(
      undefined,
      this.videoRef.nativeElement,
      (result: Result | undefined, error: Error | undefined, controls) => {
        this.controls = controls;

        if (result) {
          this.onCodeResult(result.getText());
          controls.stop(); // direkt hier oder im destroy
        } else if (error) {
          this.onScanFailure(error);
        }
      }
    ).catch(err => {
      this.onScanError(err);
    });
  }

  ngOnDestroy(): void {
    this.controls?.stop();
  }

  onCodeResult(resultString: string): void {
    if (this.data.mode === 'add_connect') {
      this.data.connectId = resultString;
    }
    this.dialogRef.close(this.data);
  }

  onScanFailure(error: Error): void {
    console.warn('Scan failure', error);
  }

  onScanError(err: unknown): void {
    console.error('Scan error:', err);
  }
}
