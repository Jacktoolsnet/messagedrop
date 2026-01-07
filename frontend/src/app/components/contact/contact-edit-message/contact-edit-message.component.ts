import { Component, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Mode } from '../../../interfaces/mode';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { ShortMessage } from '../../../interfaces/short-message';
import { OembedService } from '../../../services/oembed.service';
import { StyleService } from '../../../services/style.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user.service';
import { SelectMultimediaComponent } from '../../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from "../../multimedia/showmultimedia/showmultimedia.component";
import { TenorComponent } from '../../utils/tenor/tenor.component';
import { TextComponent } from '../../utils/text/text.component';

interface TenorDialogResult {
  title?: string;
  content_description?: string;
  media_formats?: { gif?: { url: string } };
  itemurl?: string;
}

interface TextDialogResult {
  text: string;
}

@Component({
  selector: 'app-message',
  imports: [
    SelectMultimediaComponent,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    ShowmultimediaComponent,
    TranslocoPipe
  ],
  templateUrl: './contact-edit-message.component.html',
  styleUrl: './contact-edit-message.component.css'
})
export class ContactEditMessageComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);
  readonly userService = inject(UserService);
  private readonly oembedService = inject(OembedService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly matDialog = inject(MatDialog);
  readonly dialogRef = inject(MatDialogRef<ContactEditMessageComponent>);
  private readonly style = inject(StyleService);
  private readonly translation = inject(TranslationHelperService);
  readonly data = inject<{ mode: Mode; contact: Contact; shortMessage: ShortMessage }>(MAT_DIALOG_DATA);

  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml = false;

  ngOnInit(): void {
    const multimedia = this.data.shortMessage.multimedia;
    if (multimedia) {
      this.updateSafeHtml();
      this.showSaveHtml = multimedia.type !== MultimediaType.TENOR;
    }
    this.data.shortMessage.style = this.userService.getProfile().defaultStyle ?? this.data.shortMessage.style;
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onAbortClick(): void {
    this.dialogRef.close();
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.shortMessage.style = this.style.getRandomStyle();
  }

  public showPolicy() {
    this.snackBar.open(
      this.translation.t('common.contact.message.policy'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

  public openTenorDialog(): void {
    const tenorDialogRef = this.matDialog.open(TenorComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    tenorDialogRef.afterClosed().subscribe((result?: TenorDialogResult) => {
      if (!result) {
        return;
      }
      const multimedia = this.data.shortMessage.multimedia;
      if (!multimedia) {
        return;
      }
      multimedia.type = MultimediaType.TENOR;
      multimedia.attribution = this.translation.t('common.media.tenorAttribution');
      multimedia.title = result.title ?? '';
      multimedia.description = result.content_description ?? '';
      multimedia.url = result.media_formats?.gif?.url ?? '';
      multimedia.sourceUrl = result.itemurl ?? '';
      this.updateSafeHtml();
      this.showSaveHtml = false;
    });
  }

  applyNewMultimedia(newMultimedia: Multimedia) {
    this.data.shortMessage.multimedia = newMultimedia;
    this.updateSafeHtml();
    this.showSaveHtml = newMultimedia.type !== MultimediaType.TENOR;
  }

  public removeMultimedia(): void {
    const multimedia = this.data.shortMessage.multimedia;
    if (!multimedia) {
      return;
    }
    multimedia.type = MultimediaType.UNDEFINED;
    multimedia.attribution = '';
    multimedia.title = '';
    multimedia.description = '';
    multimedia.url = '';
    multimedia.sourceUrl = '';
    this.showSaveHtml = false;
    this.safeHtml = undefined;
  }

  public openTextDialog(): void {
    const textDialogRef = this.matDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { text: this.data.shortMessage.message },
      hasBackdrop: true,
      autoFocus: true
    });

    textDialogRef.afterClosed().subscribe((result?: TextDialogResult) => {
      if (result?.text != null) {
        this.data.shortMessage.message = result.text;
      }
    });
  }

  public removeText(): void {
    this.data.shortMessage.message = '';
  }

  private updateSafeHtml(): void {
    const multimedia = this.data.shortMessage.multimedia;
    const html = multimedia?.oembed?.html ?? '';
    this.safeHtml = this.oembedService.isAllowedOembedSource(multimedia?.sourceUrl, multimedia?.oembed?.provider_url)
      ? this.sanitizer.bypassSecurityTrustHtml(html)
      : undefined;
  }
}
