
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from "@angular/material/icon";
import { TranslocoPipe } from '@jsverse/transloco';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qrcode',
  imports: [
    MatDialogContent,
    MatButtonModule,
    MatDialogTitle,
    MatDialogActions,
    MatDialogClose,
    TranslocoPipe,
    MatIcon
  ],
  templateUrl: './qrcode.component.html',
  styleUrl: './qrcode.component.css'
})
export class QrcodeComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly dialogData = inject<{ qrData: string }>(MAT_DIALOG_DATA);

  ngOnInit(): void {
    QRCode.toCanvas(this.canvasRef.nativeElement, this.dialogData.qrData, {
      width: 256,
      errorCorrectionLevel: 'M'
    }, (error?: Error | null) => {
      if (error) {
        console.error('Failed to render QR code', error);
      }
    });
  }

}
