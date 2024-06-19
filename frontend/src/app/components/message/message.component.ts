import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogModule, MatDialogContainer, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { StyleService } from '../../services/style.service';
import { Message } from '../../interfaces/message';
import { User } from '../../interfaces/user';
import { MessageMode } from '../../interfaces/message-mode';

@Component({
  selector: 'app-dropmessage',
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
export class MessageComponent implements OnInit {
  
  constructor(
    public dialogRef: MatDialogRef<MessageComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: {mode: MessageMode, user: User, message: Message}
  ) {}

  ngOnInit(): void {
    if (this.data.message.style === '') {
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
    this.data.message.style = `
    ${this.style.getRandomFontFamily()}
    font-size: 2rem;
    line-height: 1.6;`;
  }

}
