
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from "@angular/material/icon";
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmoticonPickerComponent } from '../emoticon-picker/emoticon-picker.component';
import { HelpDialogService } from '../help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';

interface TextDialogData {
  text: string;
  titleKey?: string;
  titleIcon?: string;
}

@Component({
  selector: 'app-message',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './text.component.html',
  styleUrl: './text.component.css'
})
export class TextComponent {
  private readonly matDialog = inject(MatDialog);
  readonly dialogRef = inject(MatDialogRef<TextComponent>);
  readonly data = inject<TextDialogData>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  readonly titleKey = this.data.titleKey ?? 'common.textDialog.editTitle';
  readonly titleIcon = this.data.titleIcon ?? 'edit';
  @ViewChild('textArea') private textArea?: ElementRef<HTMLTextAreaElement>;

  private selectionStart = this.data.text?.length ?? 0;
  private selectionEnd = this.data.text?.length ?? 0;

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onAbortClick(): void {
    this.dialogRef.close();
  }

  rememberSelection(): void {
    const textarea = this.textArea?.nativeElement;
    if (!textarea) {
      const textLength = this.data.text?.length ?? 0;
      this.selectionStart = textLength;
      this.selectionEnd = textLength;
      return;
    }

    this.selectionStart = textarea.selectionStart ?? (this.data.text?.length ?? 0);
    this.selectionEnd = textarea.selectionEnd ?? this.selectionStart;
  }

  openEmojiPicker(): void {
    this.rememberSelection();
    const dialogRef = this.matDialog.open(EmoticonPickerComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {
        reactions: [],
        current: null,
        allowRemove: false,
        multiSelect: true
      },
      maxWidth: '95vw',
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result: string | null | undefined) => {
      if (!result) {
        return;
      }
      this.insertEmoji(result);
    });
  }

  private insertEmoji(emoji: string): void {
    const currentText = this.data.text ?? '';
    const start = Math.max(0, Math.min(this.selectionStart, currentText.length));
    const end = Math.max(start, Math.min(this.selectionEnd, currentText.length));

    this.data.text = `${currentText.slice(0, start)}${emoji}${currentText.slice(end)}`;

    const nextCursor = start + emoji.length;
    this.selectionStart = nextCursor;
    this.selectionEnd = nextCursor;

    queueMicrotask(() => {
      const textarea = this.textArea?.nativeElement;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }
}
