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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { MessageService } from '../../services/message.service';
import { OpenAiService } from '../../services/open-ai.service';
import { StyleService } from '../../services/style.service';
import { UserService } from '../../services/user.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { TextComponent } from '../utils/text/text.component';
import { WaitComponent } from '../utils/wait/wait.component';

@Component({
  selector: 'app-message',
  imports: [
    SelectMultimediaComponent,
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
  templateUrl: './edit-message.component.html',
  styleUrl: './edit-message.component.css'
})
export class EditMessageComponent implements OnInit {
  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml: boolean = false;

  constructor(
    private userService: UserService,
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar,
    private textDialog: MatDialog,
    private messageService: MessageService,
    private openAiService: OpenAiService,
    public dialogRef: MatDialogRef<EditMessageComponent>,
    private style: StyleService,
    private waitDialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, message: Message }
  ) { }

  ngOnInit(): void {
    this.data.message.style = this.userService.getUser().defaultStyle;
    this.applyNewMultimedia(this.data.message.multimedia);
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
          if (this.data.message.message !== '') {
            const waitDialogRef = this.waitDialog.open(WaitComponent, {
              data: { title: 'AI Moderation', message: `My message is currently being reviewed by OpenAi's moderation AI.` },
              closeOnNavigation: false,
              hasBackdrop: false
            });
            this.openAiService.moderateMessage(this.data.message)
              .subscribe({
                next: openAiModerateResponse => {
                  if (!openAiModerateResponse.results[0].flagged) {
                    this.data.message.userId = this.userService.getUser().id;
                    waitDialogRef.close();
                    this.dialogRef.close(this.data);
                  } else {
                    // abgelehnt
                    waitDialogRef.close();
                    this.snackBar.open(`My message will not be published because it was rejected by the moderation AI`, 'OK', { horizontalPosition: 'center', verticalPosition: 'top' });
                  }
                },
                error: (err) => { },
                complete: () => { }
              });
          } else {
            this.data.message.userId = this.userService.getUser().id;
            this.data.message.message = ''
            this.dialogRef.close(this.data);
          }
        }
        break;
      default:
        this.data.message.userId = this.userService.getUser().id;
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

  applyNewMultimedia(newMultimedia: Multimedia) {
    this.data.message.multimedia = newMultimedia;
    this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.data.message.multimedia?.oembed?.html ? this.data.message.multimedia?.oembed.html : '');
    this.showSaveHtml = this.data.message.multimedia.type != MultimediaType.TENOR;
  }

  public removeMultimedia(): void {
    this.data.message.multimedia.type = MultimediaType.UNDEFINED
    this.data.message.multimedia.attribution = '';
    this.data.message.multimedia.title = '';
    this.data.message.multimedia.description = '';
    this.data.message.multimedia.url = '';
    this.data.message.multimedia.sourceUrl = '';
    this.safeHtml = undefined;
    this.showSaveHtml = false;
  }

  public openTextDialog(): void {
    const dialogRef = this.textDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { text: this.data.message.message },
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((data: any) => {
      this.data.message.message = data.text;
    });
  }

  public removeText(): void {
    this.data.message.message = '';
  }


}
