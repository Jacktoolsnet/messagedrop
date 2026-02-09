
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { DisplayMessageConfig } from '../../interfaces/display-message-config';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { MessageService } from '../../services/message.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { LocationPickerTileComponent } from '../utils/location-picker/location-picker-tile.component';
import { TextComponent } from '../utils/text/text.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { MAX_PUBLIC_HASHTAGS, normalizeHashtags } from '../../utils/hashtag.util';

interface TextDialogResult {
  text: string;
}

interface DialogHeaderConfig {
  icon: string;
  labelKey: string;
}

@Component({
  selector: 'app-message',
  imports: [
    DialogHeaderComponent,
    SelectMultimediaComponent,
    ShowmultimediaComponent,
    LocationPickerTileComponent,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatChipsModule,
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
  private readonly messageService = inject(MessageService);
  readonly help = inject(HelpDialogService);
  readonly dialogRef = inject(MatDialogRef<EditMessageComponent>);
  private readonly style = inject(StyleService);
  readonly data = inject<{ mode: Mode; message: Message }>(MAT_DIALOG_DATA);
  readonly headerConfig = this.resolveHeaderConfig(this.data.mode);
  readonly mode = Mode;
  readonly isLocationEditable = this.data.mode === Mode.ADD_PUBLIC_MESSAGE
    || this.data.mode === Mode.EDIT_PUBLIC_MESSAGE;

  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml = false;
  hashtagInput = '';
  hashtagTags: string[] = [];
  hashtagCheckInProgress = false;

  private readonly oriMessage: string | undefined = this.data.message.message;
  private readonly oriMultimedia: Multimedia | undefined = structuredClone(this.data.message.multimedia);
  private readonly oriStyle: string | undefined = this.data.message.style;
  private readonly oriHashtags: string[] = [...(this.data.message.hashtags ?? [])];

  ngOnInit(): void {
    this.applyNewMultimedia(this.data.message.multimedia);
    this.hashtagTags = [...this.oriHashtags];
    this.hashtagInput = '';
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

  async onApplyClick(): Promise<void> {
    if (!(await this.addHashtagsFromInput(true))) {
      return;
    }
    if (!(await this.moderateHashtags(this.hashtagTags, true))) {
      return;
    }
    if (this.containsPrivateData(this.hashtagTags)) {
      this.showHashtagValidationError(
        'common.message.moderationRejectedPattern',
        'common.moderation.title',
        'block'
      );
      return;
    }
    const hashtagParse = normalizeHashtags(this.hashtagTags, MAX_PUBLIC_HASHTAGS);
    if (hashtagParse.invalidTokens.length > 0 || hashtagParse.overflow > 0) {
      this.showHashtagValidationError(
        hashtagParse.overflow > 0 ? 'common.hashtags.limitExceeded' : 'common.hashtags.invalidPublic',
        'common.hashtags.label',
        'warning'
      );
      return;
    }
    this.data.message.hashtags = hashtagParse.tags;
    this.hashtagTags = [...hashtagParse.tags];
    this.hashtagInput = '';

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
    this.data.message.hashtags = [...this.oriHashtags];
    this.hashtagTags = [...this.oriHashtags];
    this.hashtagInput = '';
    this.dialogRef.close();
  }

  async onHashtagEnter(event: Event): Promise<void> {
    event.preventDefault();
    await this.addHashtagsFromInput(true);
  }

  async onAddHashtagClick(): Promise<void> {
    await this.addHashtagsFromInput(true);
  }

  async addHashtagsFromInput(showErrors = true): Promise<boolean> {
    if (this.hashtagCheckInProgress) {
      return false;
    }
    const candidate = this.hashtagInput.trim();
    if (!candidate) {
      return true;
    }
    if (this.containsPrivateData(candidate)) {
      if (showErrors) {
        this.showHashtagValidationError(
          'common.message.moderationRejectedPattern',
          'common.moderation.title',
          'block'
        );
      }
      return false;
    }
    const parsed = normalizeHashtags(candidate, MAX_PUBLIC_HASHTAGS);
    if (parsed.invalidTokens.length > 0) {
      if (showErrors) {
        this.showHashtagValidationError(
          'common.hashtags.invalidPublic',
          'common.hashtags.label',
          'warning'
        );
      }
      return false;
    }

    const merged = normalizeHashtags([...this.hashtagTags, ...parsed.tags], MAX_PUBLIC_HASHTAGS);
    if (merged.overflow > 0) {
      if (showErrors) {
        this.showHashtagValidationError(
          'common.hashtags.limitExceeded',
          'common.hashtags.label',
          'warning'
        );
      }
      return false;
    }

    if (this.containsPrivateData(merged.tags)) {
      if (showErrors) {
        this.showHashtagValidationError(
          'common.message.moderationRejectedPattern',
          'common.moderation.title',
          'block'
        );
      }
      return false;
    }

    if (!(await this.moderateHashtags(merged.tags, showErrors))) {
      return false;
    }

    this.hashtagTags = [...merged.tags];
    this.hashtagInput = '';
    return true;
  }

  removeHashtag(tag: string): void {
    this.hashtagTags = this.hashtagTags.filter((item) => item !== tag);
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.message.style = this.style.getRandomStyle();
  }

  private containsPrivateData(input: string[] | string): boolean {
    const raw = Array.isArray(input)
      ? input.map((tag) => `#${String(tag ?? '').trim()}`).join(' ')
      : String(input ?? '').trim();
    return this.messageService.detectPersonalInformation(raw);
  }

  private showHashtagValidationError(
    messageKey: string,
    titleKey = 'common.hashtags.label',
    icon = 'warning'
  ): void {
    const config: DisplayMessageConfig = {
      showAlways: true,
      title: this.translation.t(titleKey),
      image: '',
      icon,
      message: this.translation.t(messageKey, { max: MAX_PUBLIC_HASHTAGS }),
      button: '',
      delay: 2000,
      showSpinner: false,
      autoclose: true
    };

    this.matDialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  private async moderateHashtags(tags: string[], showErrors = true): Promise<boolean> {
    if ((tags ?? []).length === 0) {
      return true;
    }
    this.hashtagCheckInProgress = true;
    try {
      const response = await firstValueFrom(this.messageService.moderatePublicHashtags(tags));
      const decision = response?.moderation?.decision ?? 'approved';
      if (decision === 'rejected') {
        if (!showErrors) {
          return false;
        }
        const reason = response?.moderation?.reason ?? null;
        const key = reason === 'pattern'
          ? 'common.message.moderationRejectedPattern'
          : reason === 'ai'
            ? 'common.message.moderationRejectedAi'
            : 'common.message.moderationRejected';
        this.showHashtagValidationError(key, 'common.moderation.title', 'block');
        return false;
      }
      return true;
    } catch {
      if (showErrors) {
        this.showHashtagValidationError('common.message.moderationFailed', 'common.moderation.title', 'warning');
      }
      return false;
    } finally {
      this.hashtagCheckInProgress = false;
    }
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
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
