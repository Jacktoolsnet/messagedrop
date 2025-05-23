import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { Mode } from '../../../interfaces/mode';

@Component({
  selector: 'app-scanner',
  imports: [
    ZXingScannerModule
  ],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.css'
})
export class ScannerComponent {

  formatsEnabled: BarcodeFormat[] = [
    BarcodeFormat.QR_CODE,
  ];

  constructor(
    public dialogRef: MatDialogRef<ScannerComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, connectId: string }
  ) { }

  onCodeResult(resultString: string) {
    switch (this.data.mode) {
      case 'add_connect':
        this.data.connectId = resultString
        break
    }
    this.dialogRef.close(this.data);
  }

  onScanFailure() { }

  onScanError(err: any) { }
}
