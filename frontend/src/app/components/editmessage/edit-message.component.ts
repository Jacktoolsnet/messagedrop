
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { LocationPickerTileComponent } from '../utils/location-picker/location-picker-tile.component';
import { TextComponent } from '../utils/text/text.component';

interface TextDialogResult {
  text: string;
}

type DialogHeaderConfig = {
  icon: string;
  labelKey: string;
};

@Component({
  selector: 'app-message',
  imports: [
    SelectMultimediaComponent,
    ShowmultimediaComponent,
    LocationPickerTileComponent,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
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
  private readonly oembedService = inject(OembedService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly matDialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<EditMessageComponent>);
  private readonly style = inject(StyleService);
  readonly data = inject<{ mode: Mode; message: Message }>(MAT_DIALOG_DATA);
  readonly headerConfig = this.resolveHeaderConfig(this.data.mode);
  readonly mode = Mode;
  readonly isLocationEditable = this.data.mode === Mode.ADD_PUBLIC_MESSAGE
    || this.data.mode === Mode.EDIT_PUBLIC_MESSAGE;

  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml = false;

  private readonly oriMessage: string | undefined = this.data.message.message;
  private readonly oriMultimedia: Multimedia | undefined = structuredClone(this.data.message.multimedia);
  private readonly oriStyle: string | undefined = this.data.message.style;

  ngOnInit(): void {
    this.applyNewMultimedia(this.data.message.multimedia);
  }

  private resolveHeaderConfig(mode: Mode): DialogHeaderConfig {
    switch (mode) {
      case Mode.EDIT_PUBLIC_MESSAGE:
        return { icon: 'edit', labelKey: 'common.messageList.editAria' };
      case Mode.ADD_COMMENT:
        return { icon: 'add_comment', labelKey: 'common.messageList.addCommentAria' };
      case Mode.EDIT_COMMENT:
        return { icon: 'mode_comment', labelKey: 'common.messageList.editCommentAria' };
      case Mode.ADD_PUBLIC_MESSAGE:
      default:
        return { icon: 'chat_add_on', labelKey: 'common.messageList.addMessageAria' };
    }
  }

  onApplyClick(): void {
    switch (this.data.mode) {
      case 'add_public_message':
      case 'edit_public_message':
      case 'add_comment':
      case 'edit_comment':
        this.data.message.userId = this.userService.getUser().id;
        this.data.message.message = this.data.message.message ?? '';
        this.dialogRef.close(this.data);
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
    this.safeHtml = this.oembedService.isAllowedOembedSource(newMultimedia?.sourceUrl, newMultimedia?.oembed?.provider_url)
      ? this.sanitizer.bypassSecurityTrustHtml(html)
      : undefined;
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
      autoFocus: true
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

  public updateLocation(location: Location): void {
    this.data.message.location = { ...location };
  }


}
