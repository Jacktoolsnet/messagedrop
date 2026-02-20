import { Component, inject } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { HashtagSuggestionService } from '../../../services/hashtag-suggestion.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { MAX_LOCAL_HASHTAGS, MAX_PUBLIC_HASHTAGS, normalizeHashtags } from '../../../utils/hashtag.util';
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
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatChipsModule,
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
  private readonly hashtagSuggestionService = inject(HashtagSuggestionService);
  readonly help = inject(HelpDialogService);

  readonly maxTags = this.data.mode === 'public' ? MAX_PUBLIC_HASHTAGS : MAX_LOCAL_HASHTAGS;
  hashtagInput = '';
  hashtagTags = [...(this.data.initialTags ?? [])];
  errorText = '';

  onHashtagEnter(event: Event): void {
    event.preventDefault();
    this.addHashtagsFromInput();
  }

  onAddHashtagClick(): void {
    this.addHashtagsFromInput();
  }

  onHashtagSuggestionSelected(tag: string): void {
    this.hashtagInput = tag;
    this.addHashtagsFromInput();
  }

  removeHashtag(tag: string): void {
    this.hashtagTags = this.hashtagTags.filter((item) => item !== tag);
  }

  onApply(): void {
    if (!this.addHashtagsFromInput()) {
      return;
    }
    const parsed = normalizeHashtags(this.hashtagTags, this.maxTags);
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

  private addHashtagsFromInput(): boolean {
    const candidate = this.hashtagInput.trim();
    if (!candidate) {
      return true;
    }

    const parsed = normalizeHashtags(candidate, this.maxTags);
    if (parsed.invalidTokens.length > 0) {
      this.errorText = this.i18n.t(
        this.data.mode === 'public' ? 'common.hashtags.invalidPublic' : 'common.hashtags.invalidLocal',
        { max: this.maxTags }
      );
      return false;
    }

    const merged = normalizeHashtags([...this.hashtagTags, ...parsed.tags], this.maxTags);
    if (merged.overflow > 0) {
      this.errorText = this.i18n.t('common.hashtags.limitExceeded', { max: this.maxTags });
      return false;
    }

    this.hashtagTags = [...merged.tags];
    this.hashtagInput = '';
    this.errorText = '';
    return true;
  }

  getHashtagSuggestions(): string[] {
    return this.hashtagSuggestionService.suggest(this.hashtagInput, {
      exclude: this.hashtagTags,
      limit: 12
    });
  }
}
