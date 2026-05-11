import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { FontOption, StyleService } from '../../../services/style.service';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

export interface FontPickerDialogData {
  readonly currentStyle?: string;
}

@Component({
  selector: 'app-font-picker-dialog',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    TranslocoPipe
  ],
  templateUrl: './font-picker-dialog.component.html',
  styleUrl: './font-picker-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FontPickerDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FontPickerDialogComponent, string | undefined>);
  private readonly data = inject<FontPickerDialogData>(MAT_DIALOG_DATA);
  private readonly styleService = inject(StyleService);
  private readonly help = inject(HelpDialogService);

  readonly fonts = this.styleService.getFonts();
  readonly selectedFamily = signal(this.resolveInitialFamily());
  readonly selectedFont = computed(() => this.fonts.find((font) => font.family === this.selectedFamily()) ?? this.fonts[0]);

  selectFont(font: FontOption): void {
    this.selectedFamily.set(font.family);
  }

  isSelected(font: FontOption): boolean {
    return this.selectedFamily() === font.family;
  }

  fontTileStyle(font: FontOption): string {
    return this.styleService.getFontFamilyStyle(font);
  }

  onAbortClick(): void {
    this.dialogRef.close(undefined);
  }

  onApplyClick(): void {
    this.dialogRef.close(this.styleService.getStyleForFont(this.selectedFont()));
  }

  openHelp(): void {
    this.help.open('fontPicker');
  }

  private resolveInitialFamily(): string {
    const currentFamily = this.styleService.getFontFamilyFromStyle(this.data.currentStyle);
    if (currentFamily && this.fonts.some((font) => font.family === currentFamily)) {
      return currentFamily;
    }
    return this.fonts[0]?.family ?? 'LuckiestGuy';
  }
}
