import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DisplayMessageConfig } from '../../../interfaces/display-message-config';

@Component({
  selector: 'app-server-error',
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIcon
  ],
  templateUrl: './display-message.component.html',
  styleUrl: './display-message.component.css'
})
export class DisplayMessage implements OnInit {
  public showOk = false;

  readonly dialogRef = inject(MatDialogRef<DisplayMessage>);
  readonly data = inject<DisplayMessageConfig>(MAT_DIALOG_DATA);

  ngOnInit(): void {
    setTimeout(() => {
      this.showOk = true;
    }, this.data.delay);
  }
}
