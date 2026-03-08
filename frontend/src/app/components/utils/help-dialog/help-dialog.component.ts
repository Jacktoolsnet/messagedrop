import { ChangeDetectorRef, Component, DestroyRef, OnDestroy, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { AppService } from '../../../services/app.service';
import { SpeechService } from '../../../services/speech.service';
import { DisplayMessage } from '../display-message/display-message.component';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';

export interface HelpItem {
  icon: string;
  titleKey: string;
  descriptionKey: string;
}

export interface HelpDialogData {
  titleKey: string;
  introKey: string;
  items: HelpItem[];
}

const GENERIC_READ_ALOUD_ITEM: HelpItem = {
  icon: 'record_voice_over',
  titleKey: 'common.items.readAloud.title',
  descriptionKey: 'common.items.readAloud.desc'
};

@Component({
  selector: 'app-help-dialog',
  imports: [
    DialogHeaderComponent,
    CommonModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './help-dialog.component.html',
  styleUrl: './help-dialog.component.css'
})
export class HelpDialogComponent implements OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<HelpDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly appService = inject(AppService);
  private readonly speechService = inject(SpeechService);
  readonly data = inject<HelpDialogData>(MAT_DIALOG_DATA);
  private readonly speechTargetId = `help:${this.data.titleKey}`;
  readonly items = computed(() =>
    this.data.items.some((item) => item.titleKey.endsWith('.items.readAloud.title'))
      ? this.data.items
      : [...this.data.items, GENERIC_READ_ALOUD_ITEM]
  );

  constructor() {
    this.transloco.langChanges$
      .pipe(
        switchMap((lang) => this.transloco.load(`help/${lang}`)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.stopReadAloud();
        this.cdr.markForCheck();
      });
  }

  t(key: string): string {
    return this.transloco.translate(`help.${key}`);
  }

  ngOnDestroy(): void {
    this.stopReadAloud();
  }

  toggleReadAloud(): void {
    if (!this.speechService.supported()) {
      this.showReadAloudHint('common.speech.unsupported');
      return;
    }

    if (!this.appService.getAppSettings().speech?.enabled) {
      this.showReadAloudHint('common.speech.disabled');
      return;
    }

    const text = this.getReadAloudText();
    if (!text) {
      return;
    }

    this.speechService.toggle({
      targetId: this.speechTargetId,
      text
    });
  }

  isReadAloudActive(): boolean {
    return this.speechService.isActive(this.speechTargetId);
  }

  getReadAloudIcon(): string {
    return this.isReadAloudActive() ? 'stop' : 'volume_up';
  }

  getReadAloudLabel(): string {
    return this.transloco.translate(
      this.isReadAloudActive()
        ? 'common.actions.stopReadAloud'
        : 'common.actions.readAloud'
    );
  }

  close(): void {
    this.stopReadAloud();
    this.dialogRef.close();
  }

  private getReadAloudText(): string {
    const parts = [
      this.t(this.data.titleKey),
      this.t(this.data.introKey),
      ...this.items().flatMap((item) => [
        this.t(item.titleKey),
        this.t(item.descriptionKey)
      ])
    ]
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.join('\n\n');
  }

  private stopReadAloud(): void {
    this.speechService.stopIfCurrentTarget(this.speechTargetId);
  }

  private showReadAloudHint(messageKey: string): void {
    this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.transloco.translate('common.actions.readAloud'),
        image: '',
        icon: 'record_voice_over',
        message: this.transloco.translate(messageKey),
        button: this.transloco.translate('common.actions.ok'),
        delay: 0,
        showSpinner: false,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }
}
