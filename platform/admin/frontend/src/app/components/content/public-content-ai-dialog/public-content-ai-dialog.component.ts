import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { AiToolRequest } from '../../../interfaces/ai-tool-request.interface';
import { AiToolResult } from '../../../interfaces/ai-tool-result.interface';
import { AiTool } from '../../../interfaces/ai-tool.type';
import { DisplayMessageConfig } from '../../../interfaces/display-message-config.interface';
import { AiService } from '../../../services/content/ai.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DisplayMessageComponent } from '../../shared/display-message/display-message.component';
import { DialogActionBarComponent } from '../../shared/dialog-action-bar/dialog-action-bar.component';
import { DialogHeaderComponent } from '../../shared/dialog-header/dialog-header.component';

const DEEPL_TARGET_LANGUAGE_OPTIONS = [
  { value: 'AR', label: 'Arabic' },
  { value: 'BG', label: 'Bulgarian' },
  { value: 'CS', label: 'Czech' },
  { value: 'DA', label: 'Danish' },
  { value: 'DE', label: 'German' },
  { value: 'EL', label: 'Greek' },
  { value: 'EN-GB', label: 'English (British)' },
  { value: 'EN-US', label: 'English (American)' },
  { value: 'ES', label: 'Spanish' },
  { value: 'ES-419', label: 'Spanish (Latin America)' },
  { value: 'ET', label: 'Estonian' },
  { value: 'FI', label: 'Finnish' },
  { value: 'FR', label: 'French' },
  { value: 'HU', label: 'Hungarian' },
  { value: 'ID', label: 'Indonesian' },
  { value: 'IT', label: 'Italian' },
  { value: 'JA', label: 'Japanese' },
  { value: 'KO', label: 'Korean' },
  { value: 'LT', label: 'Lithuanian' },
  { value: 'LV', label: 'Latvian' },
  { value: 'NB', label: 'Norwegian (Bokmål)' },
  { value: 'NL', label: 'Dutch' },
  { value: 'PL', label: 'Polish' },
  { value: 'PT-BR', label: 'Portuguese (Brazil)' },
  { value: 'PT-PT', label: 'Portuguese (Portugal)' },
  { value: 'RO', label: 'Romanian' },
  { value: 'RU', label: 'Russian' },
  { value: 'SK', label: 'Slovak' },
  { value: 'SL', label: 'Slovenian' },
  { value: 'SV', label: 'Swedish' },
  { value: 'TR', label: 'Turkish' },
  { value: 'UK', label: 'Ukrainian' },
  { value: 'ZH', label: 'Chinese' },
  { value: 'ZH-HANS', label: 'Chinese (Simplified)' },
  { value: 'ZH-HANT', label: 'Chinese (Traditional)' }
] as const;

export interface PublicContentAiDialogData {
  tool: AiTool;
  model: string;
  text: string;
  contentType: 'public' | 'comment';
  locationLabel: string;
  publicProfileName: string;
  publicProfileGuidance?: string;
  parentLabel: string;
  existingHashtags: string[];
  multimedia: {
    type: string;
    title: string;
    description: string;
  };
}

export interface PublicContentAiDialogResult {
  action: 'replace_text' | 'append_text' | 'replace_hashtags' | 'append_hashtags';
  text?: string;
  hashtags?: string[];
}

@Component({
  selector: 'app-public-content-ai-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogContent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    DialogHeaderComponent,
    DialogActionBarComponent
  ],
  templateUrl: './public-content-ai-dialog.component.html',
  styleUrl: './public-content-ai-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicContentAiDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PublicContentAiDialogComponent, PublicContentAiDialogResult>);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<PublicContentAiDialogData>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly aiService = inject(AiService);
  readonly i18n = inject(TranslationHelperService);
  private loadingDialogRef: MatDialogRef<DisplayMessageComponent> | null = null;

  readonly loading = signal(false);
  readonly result = signal<AiToolResult | null>(null);

  readonly tool = this.data.tool;
  readonly deeplTargetLanguageOptions = DEEPL_TARGET_LANGUAGE_OPTIONS;
  readonly form = this.fb.nonNullable.group({
    targetLanguage: this.fb.nonNullable.control('EN-US'),
    rewriteGoal: this.fb.nonNullable.control('clearer'),
    hashtagCount: this.fb.nonNullable.control(8)
  });

  readonly title = computed(() => {
    switch (this.tool) {
      case 'proofread':
        return this.i18n.t('Proofread text');
      case 'rewrite':
        return this.i18n.t('Rewrite suggestions');
      case 'translate':
        return this.i18n.t('Translate text');
      case 'hashtags':
        return this.i18n.t('Generate hashtags');
      case 'emoji':
        return this.i18n.t('Emoji suggestions');
      case 'thread':
        return this.i18n.t('Thread suggestions');
      case 'quality_check':
        return this.i18n.t('Quality check');
      case 'content_creator':
        return this.i18n.t('AI Content Creator');
    }
  });

  readonly canGenerate = computed(() => {
    if (this.loading()) {
      return false;
    }

    if (this.tool === 'proofread' || this.tool === 'rewrite' || this.tool === 'translate' || this.tool === 'emoji' || this.tool === 'thread' || this.tool === 'quality_check') {
      return this.data.text.trim().length > 0;
    }

    return !!(
      this.data.text.trim()
      || this.data.locationLabel.trim()
      || this.data.multimedia.title.trim()
      || this.data.multimedia.description.trim()
    );
  });

  readonly resultText = computed(() => this.result()?.text?.trim() || '');
  readonly rewriteSuggestions = computed(() => this.result()?.suggestions ?? []);
  readonly generatedHashtags = computed(() => this.result()?.hashtags ?? []);
  readonly emojiTextSuggestions = computed(() => this.result()?.suggestions ?? this.result()?.emojiSuggestions ?? []);
  readonly qualityCheck = computed(() => this.result()?.qualityCheck ?? null);
  readonly preferredResponseLanguage = this.resolvePreferredResponseLanguage();

  close(): void {
    this.closeLoadingDialog();
    this.dialogRef.close();
  }

  run(): void {
    if (!this.canGenerate()) {
      return;
    }

    this.openLoadingDialog(
      this.i18n.t('Running AI tool...'),
      this.i18n.t('Please wait while the AI processes your request.')
    );
    this.loading.set(true);
    this.result.set(null);
    this.aiService.applyTool(this.buildRequest())
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.closeLoadingDialog();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => this.result.set(result)
      });
  }

  useText(text: string): void {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    this.dialogRef.close({
      action: 'replace_text',
      text: normalized
    });
  }

  appendText(text: string): void {
    const normalized = text.trim();
    if (!normalized) {
      return;
    }
    this.dialogRef.close({
      action: 'append_text',
      text: normalized
    });
  }

  replaceHashtags(): void {
    const hashtags = this.generatedHashtags();
    if (hashtags.length === 0) {
      return;
    }
    this.dialogRef.close({
      action: 'replace_hashtags',
      hashtags
    });
  }

  appendHashtags(): void {
    const hashtags = this.generatedHashtags();
    if (hashtags.length === 0) {
      return;
    }
    this.dialogRef.close({
      action: 'append_hashtags',
      hashtags
    });
  }

  suggestionTrackBy(index: number): number {
    return index;
  }

  hashtagTrackBy(_index: number, row: string): string {
    return row;
  }

  deeplLanguageTrackBy(_index: number, option: typeof DEEPL_TARGET_LANGUAGE_OPTIONS[number]): string {
    return option.value;
  }

  qualityVerdictLabel(verdict: string): string {
    switch (verdict) {
      case 'ready':
        return this.i18n.t('Ready to publish');
      case 'good_with_minor_edits':
        return this.i18n.t('Good with minor edits');
      default:
        return this.i18n.t('Needs more work');
    }
  }

  private buildRequest(): AiToolRequest {
    return {
      tool: this.tool,
      text: this.data.text,
      contentType: this.data.contentType,
      locationLabel: this.data.locationLabel,
      publicProfileName: this.data.publicProfileName,
      publicProfileGuidance: this.data.publicProfileGuidance ?? '',
      parentLabel: this.data.parentLabel,
      existingHashtags: this.data.existingHashtags,
      targetLanguage: this.form.controls.targetLanguage.value,
      responseLanguage: this.preferredResponseLanguage,
      rewriteGoal: this.form.controls.rewriteGoal.value,
      hashtagCount: Number(this.form.controls.hashtagCount.value) || 8,
      multimedia: {
        type: this.data.multimedia.type,
        title: this.data.multimedia.title,
        description: this.data.multimedia.description
      }
    };
  }

  private resolvePreferredResponseLanguage(): string {
    return this.i18n.lang() === 'de' ? 'German' : 'English';
  }

  private openLoadingDialog(title: string, message: string): void {
    this.closeLoadingDialog();

    const config: DisplayMessageConfig = {
      showAlways: true,
      title,
      image: '',
      icon: 'hourglass_top',
      message,
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    };

    this.loadingDialogRef = this.dialog.open(DisplayMessageComponent, {
      data: config,
      disableClose: true,
      autoFocus: false,
      restoreFocus: false,
      maxWidth: '92vw'
    });
  }

  private closeLoadingDialog(): void {
    this.loadingDialogRef?.close();
    this.loadingDialogRef = null;
  }
}
