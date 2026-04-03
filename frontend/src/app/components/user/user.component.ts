import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { moderationReasonTranslationKey } from '../../constants/user-moderation-reasons';
import { UserModerationAppeal, UserModerationAppealStatus, UserModerationTarget } from '../../interfaces/user-moderation-response.interface';
import { TranslateService } from '../../services/translate.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessageRef, DisplayMessageService } from '../../services/display-message.service';

@Component({
  selector: 'app-user',
  imports: [
    DialogHeaderComponent,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatInputModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserComponent implements OnInit {
  private snackBarRef?: DisplayMessageRef;
  public connectHint = '';
  private storedDeeplApiKey = '';
  readonly userService = inject(UserService);
  readonly help = inject(HelpDialogService);
  private readonly dialogRef = inject(MatDialogRef<UserComponent>);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translateService = inject(TranslateService);
  private readonly translation = inject(TranslationHelperService);
  private readonly fb = inject(FormBuilder);

  readonly submittingTarget = signal<UserModerationTarget | null>(null);
  readonly savingDeeplApiKey = signal(false);
  readonly testingDeeplApiKey = signal(false);
  readonly revealDeeplApiKey = signal(false);
  readonly appealForm = this.fb.group({
    accountMessage: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.maxLength(4000)] }),
    postingMessage: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.maxLength(4000)] })
  });
  readonly translationSettingsForm = this.fb.group({
    deeplApiKey: this.fb.nonNullable.control('', { validators: [Validators.maxLength(128)] })
  });

  ngOnInit(): void {
    void this.userService.refreshAccountStatus({ force: true });
    this.resetTranslationSettingsForm();
  }

  public showPolicy(): void {
    this.snackBarRef = this.snackBar.open(
      this.translation.t('common.user.serverInfoHint'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

  public triggerAction(action: string): void {
    this.dialogRef.close({ action });
  }

  public openHelp(): void {
    this.help.open('user', { hasJwt: this.userService.hasJwt() });
  }

  hasStoredDeeplApiKey(): boolean {
    return this.storedDeeplApiKey.length > 0;
  }

  translationKeyChanged(): boolean {
    return this.normalizeDeeplApiKey(this.translationSettingsForm.controls.deeplApiKey.getRawValue()) !== this.storedDeeplApiKey;
  }

  toggleDeeplApiKeyVisibility(): void {
    this.revealDeeplApiKey.update((value) => !value);
  }

  async saveDeeplApiKey(): Promise<void> {
    const control = this.translationSettingsForm.controls.deeplApiKey;
    if (control.invalid) {
      control.markAsTouched();
      return;
    }
    if (!this.translationKeyChanged()) {
      return;
    }

    this.savingDeeplApiKey.set(true);
    try {
      const normalized = this.normalizeDeeplApiKey(control.getRawValue());
      await this.userService.setDeeplApiKey(normalized || null);
      this.storedDeeplApiKey = this.userService.getDeeplApiKey();
      control.setValue(this.storedDeeplApiKey, { emitEvent: false });
      this.revealDeeplApiKey.set(false);
      this.snackBar.open(
        this.translation.t(
          this.storedDeeplApiKey
            ? 'common.user.translationSettings.saveSuccess'
            : 'common.user.translationSettings.clearSuccess'
        ),
        this.translation.t('common.actions.ok'),
        { duration: 3000 }
      );
    } catch {
      this.snackBar.open(
        this.translation.t('common.user.translationSettings.saveError'),
        this.translation.t('common.actions.ok'),
        { duration: 4000 }
      );
    } finally {
      this.savingDeeplApiKey.set(false);
    }
  }

  async clearDeeplApiKey(): Promise<void> {
    if (!this.hasStoredDeeplApiKey() && !this.translationKeyChanged()) {
      return;
    }
    this.translationSettingsForm.controls.deeplApiKey.setValue('', { emitEvent: false });
    await this.saveDeeplApiKey();
  }

  testDeeplApiKey(): void {
    const control = this.translationSettingsForm.controls.deeplApiKey;
    if (control.invalid) {
      control.markAsTouched();
      return;
    }

    const deeplApiKey = this.normalizeDeeplApiKey(control.getRawValue());
    if (!deeplApiKey) {
      this.snackBar.open(
        this.translation.t('common.user.translationSettings.testEmpty'),
        this.translation.t('common.actions.ok'),
        { duration: 3000 }
      );
      return;
    }

    this.testingDeeplApiKey.set(true);
    this.translateService.validateDeeplApiKey(deeplApiKey).subscribe({
      next: (response) => {
        const quotaReached = response.result?.quotaReached ?? false;
        this.snackBar.open(
          this.translation.t(
            quotaReached
              ? 'common.user.translationSettings.testSuccessQuotaReached'
              : 'common.user.translationSettings.testSuccess'
          ),
          this.translation.t('common.actions.ok'),
          { duration: 3500 }
        );
        this.testingDeeplApiKey.set(false);
      },
      error: (error) => {
        this.snackBar.open(
          this.translateService.getErrorMessage(error) ?? this.translation.t('common.user.translationSettings.testError'),
          this.translation.t('common.actions.ok'),
          { duration: 4000 }
        );
        this.testingDeeplApiKey.set(false);
      }
    });
  }

  reasonLabel(reason: string | null | undefined): string | null {
    const key = moderationReasonTranslationKey(reason);
    if (!key) {
      return null;
    }
    const translated = this.translation.t(key);
    return translated === key ? (reason || null) : translated;
  }

  appealsFor(target: UserModerationTarget): UserModerationAppeal[] {
    return this.userService.moderationAppeals().filter((appeal) => appeal.target === target);
  }

  hasOpenAppeal(target: UserModerationTarget): boolean {
    return this.appealsFor(target).some((appeal) => appeal.status === 'open');
  }

  appealStatusLabel(status: UserModerationAppealStatus): string {
    return this.translation.t(`common.user.appeal.status.${status}`);
  }

  async submitAppeal(target: UserModerationTarget): Promise<void> {
    const control = target === 'account'
      ? this.appealForm.controls.accountMessage
      : this.appealForm.controls.postingMessage;

    if (control.invalid) {
      control.markAsTouched();
      return;
    }

    this.submittingTarget.set(target);
    try {
      await this.userService.submitModerationAppeal(target, control.getRawValue());
      control.reset('');
      this.snackBar.open(
        this.translation.t('common.user.appeal.submitSuccess'),
        this.translation.t('common.actions.ok'),
        { duration: 3000 }
      );
    } catch (error) {
      this.snackBar.open(
        this.getAppealErrorMessage(error),
        this.translation.t('common.actions.ok'),
        { duration: 4000 }
      );
    } finally {
      this.submittingTarget.set(null);
    }
  }

  private getAppealErrorMessage(error: unknown): string {
    if (this.hasApiMessage(error, 'appeal_already_open')) {
      return this.translation.t('common.user.appeal.alreadyOpen');
    }
    if (this.hasApiMessage(error, 'appeal_target_not_blocked')) {
      return this.translation.t('common.user.appeal.targetNotBlocked');
    }
    if (this.hasApiMessage(error, 'appeal_message_required')) {
      return this.translation.t('common.user.appeal.messageRequired');
    }
    return this.translation.t('common.user.appeal.submitError');
  }

  private hasApiMessage(error: unknown, expected: string): boolean {
    const matchesPayload = (value: unknown): boolean => {
      if (!value || typeof value !== 'object') {
        return false;
      }
      const candidate = value as { message?: unknown; error?: unknown };
      return candidate.message === expected || candidate.error === expected;
    };

    if (matchesPayload(error)) {
      return true;
    }
    if (error instanceof HttpErrorResponse) {
      return matchesPayload(error.error);
    }
    return false;
  }

  private resetTranslationSettingsForm(): void {
    this.storedDeeplApiKey = this.userService.getDeeplApiKey();
    this.translationSettingsForm.controls.deeplApiKey.setValue(this.storedDeeplApiKey, { emitEvent: false });
    this.revealDeeplApiKey.set(false);
  }

  private normalizeDeeplApiKey(value: string | null | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
