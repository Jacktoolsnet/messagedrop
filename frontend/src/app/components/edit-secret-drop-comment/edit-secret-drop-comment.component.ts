import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { UserService } from '../../services/user.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { FontPickerDialogComponent } from '../utils/font-picker-dialog/font-picker-dialog.component';
import { TextComponent } from '../utils/text/text.component';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';

interface TextDialogResult { text: string; }
export interface SecretDropCommentEditResult { text: string; style: string; multimedia: Multimedia | null; }

@Component({
  selector: 'app-edit-secret-drop-comment',
  imports: [CommonModule, DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent, MatIconModule, SelectMultimediaComponent, ShowmultimediaComponent, TranslocoPipe],
  templateUrl: './edit-secret-drop-comment.component.html',
  styleUrl: './edit-secret-drop-comment.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class EditSecretDropCommentComponent {
  private readonly dialogRef = inject(MatDialogRef<EditSecretDropCommentComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly userService = inject(UserService);
  readonly data = inject<{ titleKey?: string }>(MAT_DIALOG_DATA, { optional: true });

  text = '';
  style = this.userService.getProfile().defaultStyle ?? '';
  multimedia: Multimedia = this.emptyMultimedia();

  get hasMultimedia(): boolean { return this.multimedia.type !== MultimediaType.UNDEFINED; }
  get hasContent(): boolean { return this.text.trim().length > 0 || this.hasMultimedia; }

  applyNewMultimedia(multimedia: Multimedia): void { this.multimedia = multimedia; }
  removeMultimedia(): void { this.multimedia = this.emptyMultimedia(); }
  removeText(): void { this.text = ''; }

  openTextDialog(): void {
    const ref = this.dialog.open(TextComponent, { panelClass: '', closeOnNavigation: true, data: { text: this.text }, hasBackdrop: true, backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: true });
    ref.afterClosed().subscribe((result?: TextDialogResult) => {
      if (result?.text != null) this.text = result.text;
    });
  }

  onFontClick(): void {
    const ref = this.dialog.open(FontPickerDialogComponent, { data: { currentStyle: this.style }, maxWidth: '95vw', width: '95vw', maxHeight: '90vh', hasBackdrop: true, backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false });
    ref.afterClosed().subscribe((style?: string) => { if (style) this.style = style; });
  }

  save(): void {
    if (!this.hasContent) return;
    this.dialogRef.close({ text: this.text.trim(), style: this.style, multimedia: this.hasMultimedia ? this.multimedia : null } satisfies SecretDropCommentEditResult);
  }

  close(): void { this.dialogRef.close(); }

  private emptyMultimedia(): Multimedia {
    return { type: MultimediaType.UNDEFINED, url: '', sourceUrl: '', attribution: '', title: '', description: '', contentId: '' };
  }
}
