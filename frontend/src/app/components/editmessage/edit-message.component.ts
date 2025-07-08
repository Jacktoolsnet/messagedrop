import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
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
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
import { UserService } from '../../services/user.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { TextComponent } from '../utils/text/text.component';

@Component({
  selector: 'app-message',
  imports: [
    SelectMultimediaComponent,
    ShowmultimediaComponent,
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
  templateUrl: './edit-message.component.html',
  styleUrl: './edit-message.component.css'
})
export class EditMessageComponent implements OnInit {
  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml: boolean = false;

  private oriMessage: string | undefined = undefined;
  private oriMultimedia: Multimedia | undefined = undefined;
  private oriStyle: string | undefined = undefined;

  constructor(
    private userService: UserService,
    private sharedContentService: SharedContentService,
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar,
    private textDialog: MatDialog,
    private messageService: MessageService,
    private openAiService: OpenAiService,
    public dialogRef: MatDialogRef<EditMessageComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, message: Message }
  ) {
    this.oriMessage = this.data.message.message;
    this.oriMultimedia = JSON.parse(JSON.stringify(this.data.message.multimedia));
    this.oriStyle = this.data.message.style
  }

  ngOnInit(): void {
    if (!this.data.message.style) {
      this.data.message.style = this.userService.getProfile().defaultStyle!;
    }
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
            this.openAiService.moderateMessage(this.data.message)
              .subscribe({
                next: openAiModerateResponse => {
                  if (!openAiModerateResponse.results[0].flagged) {
                    this.data.message.userId = this.userService.getUser().id;
                    this.dialogRef.close(this.data);
                  } else {
                    // abgelehnt
                    this.snackBar.open(`Content will not be published because it was rejected by the moderation AI`, 'OK', { horizontalPosition: 'center', verticalPosition: 'top' });
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

  onAbortClick(): void {
    if (undefined != this.oriMessage) {
      this.data.message.message = this.oriMessage;
    }
    if (undefined != this.oriMultimedia) {
      this.data.message.multimedia = this.oriMultimedia;
    }
    if (undefined != this.oriStyle) {
      this.data.message.style = this.oriStyle;
    }
    this.dialogRef.close();
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
    this.sharedContentService.deleteSharedContent('last');
    this.sharedContentService.deleteSharedContent('lastMultimedia');
    this.sharedContentService.deleteSharedContent('lastLocation');
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
