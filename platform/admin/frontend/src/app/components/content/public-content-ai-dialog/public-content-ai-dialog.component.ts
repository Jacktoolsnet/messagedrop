import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { AiToolRequest } from '../../../interfaces/ai-tool-request.interface';
import { AiToolResult } from '../../../interfaces/ai-tool-result.interface';
import { AiTool } from '../../../interfaces/ai-tool.type';
import { AiService } from '../../../services/content/ai.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

export interface PublicContentAiDialogData {
  tool: AiTool;
  model: string;
  text: string;
  contentType: 'public' | 'comment';
  locationLabel: string;
  publicProfileName: string;
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
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule
  ],
  templateUrl: './public-content-ai-dialog.component.html',
  styleUrl: './public-content-ai-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicContentAiDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PublicContentAiDialogComponent, PublicContentAiDialogResult>);
  readonly data = inject<PublicContentAiDialogData>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly aiService = inject(AiService);
  readonly i18n = inject(TranslationHelperService);

  readonly loading = signal(false);
  readonly result = signal<AiToolResult | null>(null);
  readonly selectedEmojis = signal<string[]>([]);

  readonly tool = this.data.tool;
  readonly form = this.fb.nonNullable.group({
    targetLanguage: this.fb.nonNullable.control('English'),
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
    }
  });

  readonly subtitle = computed(() => {
    switch (this.tool) {
      case 'proofread':
        return this.i18n.t('Correct spelling, grammar and punctuation while keeping the original tone.');
      case 'rewrite':
        return this.i18n.t('Generate alternative formulations for this message or comment.');
      case 'translate':
        return this.i18n.t('Translate the current text into another language.');
      case 'hashtags':
        return this.i18n.t('Suggest editorial hashtags based on text, location and media context.');
      case 'emoji':
        return this.i18n.t('Suggest fitting emojis that can be added to the current message.');
      case 'thread':
        return this.i18n.t('Generate short follow-up comments or replies for the current thread.');
      case 'quality_check':
        return this.i18n.t('Review clarity, tone and publication readiness and suggest improvements.');
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
  readonly emojiSuggestions = computed(() => this.result()?.emojiSuggestions ?? []);
  readonly hasSelectedEmojis = computed(() => this.selectedEmojis().length > 0);
  readonly qualityCheck = computed(() => this.result()?.qualityCheck ?? null);

  close(): void {
    this.dialogRef.close();
  }

  run(): void {
    if (!this.canGenerate()) {
      return;
    }

    this.loading.set(true);
    this.result.set(null);
    this.selectedEmojis.set([]);
    this.aiService.applyTool(this.buildRequest())
      .pipe(
        finalize(() => this.loading.set(false)),
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

  toggleEmojiSelection(emoji: string): void {
    this.selectedEmojis.update((current) => (
      current.includes(emoji)
        ? current.filter((entry) => entry !== emoji)
        : [...current, emoji]
    ));
  }

  isEmojiSelected(emoji: string): boolean {
    return this.selectedEmojis().includes(emoji);
  }

  appendSelectedEmojis(): void {
    const selected = this.selectedEmojis();
    if (selected.length === 0) {
      return;
    }
    this.appendText(selected.join(' '));
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

  private buildRequest(): AiToolRequest {
    return {
      tool: this.tool,
      text: this.data.text,
      contentType: this.data.contentType,
      locationLabel: this.data.locationLabel,
      publicProfileName: this.data.publicProfileName,
      parentLabel: this.data.parentLabel,
      existingHashtags: this.data.existingHashtags,
      targetLanguage: this.form.controls.targetLanguage.value,
      rewriteGoal: this.form.controls.rewriteGoal.value,
      hashtagCount: Number(this.form.controls.hashtagCount.value) || 8,
      multimedia: {
        type: this.data.multimedia.type,
        title: this.data.multimedia.title,
        description: this.data.multimedia.description
      }
    };
  }
}
