import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent } from '@angular/material/dialog';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qrcode',
  imports: [
    MatDialogContent,
    CommonModule
  ],
  templateUrl: './qrcode.component.html',
  styleUrl: './qrcode.component.css'
})
export class QrcodeComponent {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { qrData: string }) { }

  ngOnInit(): void {
    QRCode.toCanvas(this.canvasRef.nativeElement, this.data.qrData, {
      width: 256,
      errorCorrectionLevel: 'M'
    }, (error: any) => {
      if (error) console.error(error);
    });
  }

}
