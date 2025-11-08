import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, ViewChild, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qrcode',
  imports: [
    MatDialogContent,
    CommonModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogActions,
    MatDialogClose,
  ],
  templateUrl: './qrcode.component.html',
  styleUrl: './qrcode.component.css'
})
export class QrcodeComponent implements OnInit {
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
