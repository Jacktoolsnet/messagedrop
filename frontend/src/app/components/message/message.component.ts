import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { User } from '../../interfaces/user';
import { OpenAiService } from '../../services/open-ai.service';
import { StyleService } from '../../services/style.service';
import { WaitComponent } from '../utils/wait/wait.component';

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
    public waitDialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, message: Message }
  ) { }

  ngOnInit(): void {
    this.data.message.style = this.data.user.defaultStyle;
  }

  onApplyClick(): void {
    switch (this.data.mode) {
      case 'add_public_message':
      case 'edit_public_message':
      case 'add_comment':
      case 'edit_comment':
        const waitDialogRef = this.waitDialog.open(WaitComponent, {
          closeOnNavigation: false,
          hasBackdrop: false
        });
        this.openAiService.moderateMessage(this.data.message)
          .subscribe({
            next: openAiModerateResponse => {
              console.log(openAiModerateResponse)
              if (!openAiModerateResponse.results[0].flagged) {
                this.data.message.userId = this.data.user.id;
                waitDialogRef.close();
                this.dialogRef.close(this.data);
              } else {
                // abgelehnt
              }
            },
            error: (err) => {
              console.log(err);
            },
            complete: () => { }
          });
        break;
      default:
        this.data.message.userId = this.data.user.id;
        this.dialogRef.close(this.data);
        break;
    }
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
