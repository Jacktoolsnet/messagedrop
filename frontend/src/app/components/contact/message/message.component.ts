import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogModule, MatDialogContainer, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { StyleService } from '../../../services/style.service';
import { User } from '../../../interfaces/user';
import { Mode } from '../../../interfaces/mode';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ShortMessage } from '../../../interfaces/short-message';

@Component({
  selector: 'app-message',
  standalone: true,
  imports: [
    MatDialogContainer,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule],
  templateUrl: './message.component.html',
  styleUrl: './message.component.css'
})
export class ContactMessageComponent implements OnInit {

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ContactMessageComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, shortMessage: ShortMessage }
  ) { }

  ngOnInit(): void {
    if (this.data.shortMessage.style === '') {
      this.getRandomFont();
    }
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.shortMessage.style = `
    ${this.style.getRandomFontFamily()}
    font-size: 2rem;
    line-height: 1.6;`;
  }

  public showPolicy() {
    this.snackBar.open(`This information is stored on our server and is visible to everyone.`, 'OK', {});
  }

}
