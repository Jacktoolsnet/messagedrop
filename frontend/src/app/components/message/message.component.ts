import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { User } from '../../interfaces/user';
import { OpenAiService } from '../../services/open-ai.service';
import { StyleService } from '../../services/style.service';

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
export class MessageComponent implements OnInit {

  constructor(
    private snackBar: MatSnackBar,
    private openAiService: OpenAiService,
    public dialogRef: MatDialogRef<MessageComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, message: Message }
  ) { }

  ngOnInit(): void {
    this.data.message.style = this.data.user.defaultStyle;
  }

  onApplyClick(): void {
    this.openAiService.moderateMessage(this.data.message)
      .subscribe({
        next: openAiModerateResponse => {
          console.log(openAiModerateResponse)
          this.data.message.userId = this.data.user.id;
          this.dialogRef.close(this.data);
        },
        error: (err) => {
          console.log(err);
        },
        complete: () => { }
      });
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.message.style = this.style.getRandomStyle();
  }

  public showPolicy() {
    this.snackBar.open(`This information is stored on our server and is visible to everyone.`, 'OK', {});
  }

}
