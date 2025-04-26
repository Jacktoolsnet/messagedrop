import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent } from '@angular/material/dialog';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-qrcode',
  imports: [
    MatDialogContent,
    CommonModule,
    QRCodeComponent
  ],
  templateUrl: './qrcode.component.html',
  styleUrl: './qrcode.component.css'
})
export class QrcodeComponent {

  constructor(@Inject(MAT_DIALOG_DATA) public data: { qrData: string }) {
    console.log("QrcodeComponent data: ", data);
  }

}
