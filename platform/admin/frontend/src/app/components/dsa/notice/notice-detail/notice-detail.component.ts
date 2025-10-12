import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { DsaNoticeStatus } from '../../../../interfaces/dsa-notice-status.type';
import { DsaNotice } from '../../../../interfaces/dsa-notice.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { EvidenceListComponent } from "../evidence/evidence-list/evidence-list.component";

// Optional: wenn du die vorhandene PublicMessageDetailComponent nutzen willst
// import { PublicMessageDetailComponent } from '../../../shared/public-message-detail/public-message-detail.component';

type TranslationState = {
  text?: string;
  translated?: string;
  loading: boolean;
  error?: string;
};

@Component({
  selector: 'app-notice-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatTabsModule,
    MatTooltipModule,
    EvidenceListComponent
  ],
  templateUrl: './notice-detail.component.html',
  styleUrls: ['./notice-detail.component.css']
})
export class NoticeDetailComponent {
  private ref = inject(MatDialogRef<NoticeDetailComponent, boolean>);
  private data = inject<DsaNotice>(MAT_DIALOG_DATA);
  private dsa = inject(DsaService);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);

  notice = signal<DsaNotice>(this.data);
  status = signal<DsaNoticeStatus>(this.data.status as DsaNoticeStatus);

  // reportedContent kommt aus der DB als JSON-String → parsen
  contentObj = computed<any>(() => {
    try {
      // @ts-ignore
      return this.notice()?.reportedContent ? JSON.parse(this.notice()!.reportedContent as any) : null;
    } catch {
      return null;
    }
  });

  // Übersetzungszustände
  reasonI18n = signal<TranslationState>({ text: this.data.reasonText || '', loading: false });
  messageI18n = signal<TranslationState>({
    text: this.contentObj()?.message || '',
    loading: false
  });

  // Hilfen
  isPublicMessage = computed(() => (this.notice()?.reportedContentType || '').toLowerCase().includes('public'));

  close(ok = false) {
    this.ref.close(ok);
  }

  /** Übersetzung via Admin-Backend (/translate/DE/:value) */
  translateToGerman(kind: 'reason' | 'message') {
    const state = kind === 'reason' ? this.reasonI18n : this.messageI18n;
    const text = state().text?.trim();
    if (!text) return;

    state.update(s => ({ ...s, loading: true, error: undefined }));
    const url = `${environment.apiUrl}/translate/DE/${encodeURIComponent(text)}`;

    this.http.get<{ status: number; result?: { text: string }, error?: string }>(url)
      .subscribe({
        next: (res) => {
          if (res.status === 200 && res.result?.text) {
            state.update(s => ({ ...s, translated: res.result!.text, loading: false }));
          } else {
            state.update(s => ({ ...s, error: res.error || 'Translation failed', loading: false }));
          }
        },
        error: () => {
          state.update(s => ({ ...s, error: 'Network error while translating', loading: false }));
        }
      });
  }

  /** kleine Embed-Helfer */
  youtubeEmbedHtml(): string | null {
    const c = this.contentObj();
    const id = c?.multimedia?.contentId;
    if (!c || c?.multimedia?.type !== 'youtube' || !id) return null;
    const safeId = String(id).replace(/^.*v=/, '').replace(/^shorts\//, '');
    return `<iframe width="560" height="315"
            src="https://www.youtube.com/embed/${safeId}"
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }

  tenorGifUrl(): string | null {
    const c = this.contentObj();
    return c?.multimedia?.type === 'tenor' ? (c?.multimedia?.url || null) : null;
  }

  hasExternalLink(): boolean {
    const c = this.contentObj();
    return !!(this.notice().contentUrl || c?.multimedia?.sourceUrl);
  }

  externalLink(): string | null {
    const c = this.contentObj();
    return this.notice().contentUrl || c?.multimedia?.sourceUrl || null;
  }
}