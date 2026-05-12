import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { ModerationRequest } from '../../../interfaces/moderation-request.interface';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DialogActionBarComponent } from '../../shared/dialog-action-bar/dialog-action-bar.component';
import { DialogHeaderComponent } from '../../shared/dialog-header/dialog-header.component';

@Component({
  selector: 'app-moderation-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    DialogHeaderComponent,
    DialogActionBarComponent
  ],
  templateUrl: './moderation-details-dialog.component.html',
  styleUrl: './moderation-details-dialog.component.css'
})
export class ModerationDetailsDialogComponent {
  readonly data = inject<{ request: ModerationRequest }>(MAT_DIALOG_DATA);
  readonly i18n = inject(TranslationHelperService);

  get request(): ModerationRequest {
    return this.data.request;
  }

  formatLocal(ts?: number | null): string {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString(this.i18n.dateLocale());
    } catch {
      return new Date(ts).toISOString();
    }
  }

  formatScore(score?: number | null): string {
    if (score === undefined || score === null) return '-';
    return Number(score).toFixed(3);
  }

  boolLabel(value?: number | boolean | null): string {
    if (value === undefined || value === null) return '-';
    return value === true || value === 1 ? this.i18n.t('Yes') : this.i18n.t('No');
  }

  formattedAiResponse(value?: string | null): string {
    if (!value) return '-';
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
}
