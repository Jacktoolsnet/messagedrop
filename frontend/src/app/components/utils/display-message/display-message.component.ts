import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-server-error',
  imports: [
    CommonModule,
    MatButtonModule
  ],
  templateUrl: './display-message.component.html',
  styleUrl: './display-message.component.css'
})
export class DisplayMessage implements OnInit {
  public showOk = false;

  constructor(
    public dialogRef: MatDialogRef<DisplayMessage>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, image: string, message: string, button: string, delay: number }) { }

  ngOnInit(): void {
    setTimeout(() => {
      this.showOk = true;
    }, this.data.delay);
  }
}