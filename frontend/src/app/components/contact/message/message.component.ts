import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Contact } from '../../../interfaces/contact';
import { Mode } from '../../../interfaces/mode';
import { ShortMessage } from '../../../interfaces/short-message';
import { User } from '../../../interfaces/user';
import { StyleService } from '../../../services/style.service';

@Component({
  selector: 'app-message',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogTitle,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './message.component.html',
  styleUrl: './message.component.css'
})
export class ContactMessageComponent implements OnInit {

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ContactMessageComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, contact: Contact, shortMessage: ShortMessage }
  ) { }

  ngOnInit(): void {
    this.data.shortMessage.style = this.data.user.defaultStyle;
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.shortMessage.style = this.style.getRandomStyle()
  }

  public showPolicy() {
    this.snackBar.open(`This information is stored on our server and is visible to everyone.`, 'OK', {});
  }

}
