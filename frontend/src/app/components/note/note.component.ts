import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Mode } from '../../interfaces/mode';
import { Note } from '../../interfaces/note';
import { User } from '../../interfaces/user';
import { StyleService } from '../../services/style.service';

@Component({
  selector: 'app-note',
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
  templateUrl: './note.component.html',
  styleUrl: './note.component.css'
})
export class NoteComponent implements OnInit {

  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<NoteComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, note: Note }
  ) { }

  ngOnInit(): void {
    this.data.note.style = this.data.user.defaultStyle
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.note.style = this.style.getRandomStyle();
  }

  public showPolicy() {
    this.snackBar.open(`This information is stored on your device and is only visible to you.`, 'OK', {});
  }

}
