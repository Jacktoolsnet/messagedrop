
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { MessageService } from '../../services/message.service';
import { OpenAiService } from '../../services/open-ai.service';
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { TextComponent } from '../utils/text/text.component';

interface TextDialogResult {
  text: string;
}

@Component({
  selector: 'app-message',
  imports: [
    SelectMultimediaComponent,
    ShowmultimediaComponent,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    TranslocoPipe
],
  templateUrl: './edit-message.component.html',
  styleUrl: './edit-message.component.css'
})
export class EditMessageComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly snackBar = inject(MatSnackBar);
  private readonly matDialog = inject(MatDialog);
  private readonly messageService = inject(MessageService);
  private readonly openAiService = inject(OpenAiService);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<EditMessageComponent>);
  private readonly style = inject(StyleService);
  readonly data = inject<{ mode: Mode; message: Message }>(MAT_DIALOG_DATA);

  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml = false;

  private readonly oriMessage: string | undefined = this.data.message.message;
  private readonly oriMultimedia: Multimedia | undefined = structuredClone(this.data.message.multimedia);
  private readonly oriStyle: string | undefined = this.data.message.style;

  ngOnInit(): void {
    this.applyNewMultimedia(this.data.message.multimedia);
  }

  onApplyClick(): void {
    switch (this.data.mode) {
      case 'add_public_message':
      case 'edit_public_message':
      case 'add_comment':
      case 'edit_comment':
        if (this.messageService.detectPersonalInformation(this.data.message.message)) {
          this.snackBar.open(
            this.translation.t('common.message.personalInfoBlocked'),
            this.translation.t('common.actions.ok'),
            { horizontalPosition: 'center', verticalPosition: 'top' }
          );
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
                    this.snackBar.open(
                      this.translation.t('common.message.moderationRejected'),
                      this.translation.t('common.actions.ok'),
                      { horizontalPosition: 'center', verticalPosition: 'top' }
                    );
                  }
                },
                error: () => {
                  this.snackBar.open(this.translation.t('common.message.moderationFailed'), this.translation.t('common.actions.ok'), {
                    horizontalPosition: 'center',
                    verticalPosition: 'top'
                  });
                }
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
        this.dialogRef.close();
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
    this.snackBar.open(this.translation.t('common.message.policy'), this.translation.t('common.actions.ok'), {});
  }

  applyNewMultimedia(newMultimedia: Multimedia) {
    this.data.message.multimedia = newMultimedia;
    const html = newMultimedia?.oembed?.html ?? '';
    this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(html);
    this.showSaveHtml = newMultimedia.type !== MultimediaType.TENOR;
  }

  public removeMultimedia(): void {
    const multimedia = this.data.message.multimedia;
    multimedia.type = MultimediaType.UNDEFINED;
    multimedia.attribution = '';
    multimedia.title = '';
    multimedia.description = '';
    multimedia.url = '';
    multimedia.sourceUrl = '';
    this.safeHtml = undefined;
    this.showSaveHtml = false;
    this.sharedContentService.deleteSharedContent('last');
    this.sharedContentService.deleteSharedContent('lastMultimedia');
    this.sharedContentService.deleteSharedContent('lastLocation');
  }

  public openTextDialog(): void {
    const dialogRef = this.matDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { text: this.data.message.message },
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: TextDialogResult) => {
      if (result?.text != null) {
        this.data.message.message = result.text;
        if (!this.data.message.style) {
          const defaultStyle = this.userService.getProfile().defaultStyle;
          this.data.message.style = defaultStyle ?? this.data.message.style;
        }
      }
    });
  }

  public removeText(): void {
    this.data.message.message = '';
  }


}
