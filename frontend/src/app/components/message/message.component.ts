import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { User } from '../../interfaces/user';
import { MessageService } from '../../services/message.service';
import { OpenAiService } from '../../services/open-ai.service';
import { StyleService } from '../../services/style.service';
import { TenorComponent } from '../multimedia/tenor/tenor.component';
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
    MatInputModule,
    MatMenuModule
  ],
  templateUrl: './message.component.html',
  styleUrl: './message.component.css'
})
export class MessageComponent implements OnInit {

  constructor(
    private snackBar: MatSnackBar,
    public tenorDialog: MatDialog,
    private messageService: MessageService,
    private openAiService: OpenAiService,
    public dialogRef: MatDialogRef<MessageComponent>,
    private style: StyleService,
    private waitDialog: MatDialog,
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
        if (this.messageService.detectPersonalInformation(this.data.message.message)) {
          this.snackBar.open(`My message will not be published because it appears to contain personal information.`, 'OK', { horizontalPosition: 'center', verticalPosition: 'top' });
        } else {
          const waitDialogRef = this.waitDialog.open(WaitComponent, {
            data: { title: 'AI Moderation', message: `My message is currently being reviewed by OpenAi's moderation AI.` },
            closeOnNavigation: false,
            hasBackdrop: false
          });
          this.openAiService.moderateMessage(this.data.message)
            .subscribe({
              next: openAiModerateResponse => {
                if (!openAiModerateResponse.results[0].flagged) {
                  this.data.message.userId = this.data.user.id;
                  waitDialogRef.close();
                  this.dialogRef.close(this.data);
                } else {
                  // abgelehnt
                  waitDialogRef.close();
                  this.snackBar.open(`My message will not be published because it was rejected by the moderation AI`, 'OK', { horizontalPosition: 'center', verticalPosition: 'top' });
                }
              },
              error: (err) => {
                console.log(err);
              },
              complete: () => { }
            });
        }
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

  public openTenorDialog(): void {
    const dialogRef = this.tenorDialog.open(TenorComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data) {
        this.data.message.multimedia.type = MultimediaType.TENOR
        this.data.message.multimedia.attribution = 'Powered by Tenor';
        this.data.message.multimedia.title = data.title;
        this.data.message.multimedia.description = data.content_description;
        this.data.message.multimedia.url = data.media_formats.gif.url;
        this.data.message.multimedia.sourceUrl = data.itemurl;
      }
      console.log(this.data.message);
    });
  }

  public removeMultimedia(): void {
    this.data.message.multimedia.type = MultimediaType.UNDEFINED
    this.data.message.multimedia.attribution = '';
    this.data.message.multimedia.title = '';
    this.data.message.multimedia.description = '';
    this.data.message.multimedia.url = '';
    this.data.message.multimedia.sourceUrl = '';
  }


}
