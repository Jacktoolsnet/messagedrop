import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { MAX_LOCAL_HASHTAGS, MAX_PUBLIC_HASHTAGS, normalizeHashtags, stringifyHashtags } from '../../../utils/hashtag.util';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';
import { HelpDialogService, HelpTopic } from '../help-dialog/help-dialog.service';

export interface HashtagEditDialogData {
  titleKey: string;
  mode: 'local' | 'public';
  initialTags?: string[];
  helpKey?: HelpTopic;
}

export interface HashtagEditDialogResult {
  hashtags: string[];
}

@Component({
  selector: 'app-hashtag-edit-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    TranslocoPipe
  ],
  templateUrl: './hashtag-edit-dialog.component.html',
  styleUrl: './hashtag-edit-dialog.component.css'
})
export class HashtagEditDialogComponent {
  readonly data = inject<HashtagEditDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<HashtagEditDialogComponent, HashtagEditDialogResult>);
  private readonly i18n = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);

  readonly maxTags = this.data.mode === 'public' ? MAX_PUBLIC_HASHTAGS : MAX_LOCAL_HASHTAGS;
  inputValue = stringifyHashtags(this.data.initialTags ?? []);
  errorText = '';

  onApply(): void {
    const parsed = normalizeHashtags(this.inputValue, this.maxTags);
    if (parsed.invalidTokens.length > 0 || parsed.overflow > 0) {
      this.errorText = this.i18n.t(
        this.data.mode === 'public' ? 'common.hashtags.invalidPublic' : 'common.hashtags.invalidLocal',
        { max: this.maxTags }
      );
      return;
    }
    this.errorText = '';
    this.dialogRef.close({ hashtags: parsed.tags });
  }
}
