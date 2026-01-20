import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

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

@Component({
  selector: 'app-help-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './help-dialog.component.html',
  styleUrl: './help-dialog.component.css'
})
export class HelpDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<HelpDialogComponent>);
  private readonly transloco = inject(TranslocoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = inject<HelpDialogData>(MAT_DIALOG_DATA);

  constructor() {
    this.transloco.langChanges$
      .pipe(
        switchMap((lang) => this.transloco.load(`help/${lang}`)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.cdr.markForCheck());
  }

  t(key: string): string {
    return this.transloco.translate(`help.${key}`);
  }

  close(): void {
    this.dialogRef.close();
  }
}
