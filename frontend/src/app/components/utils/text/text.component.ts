import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { EditMessageComponent } from '../../editmessage/edit-message.component';

@Component({
  selector: 'app-message',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule
  ],
  templateUrl: './text.component.html',
  styleUrl: './text.component.css'
})
export class TextComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<EditMessageComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { text: string }
  ) { }

  ngOnInit(): void {
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }
}
