import { Clipboard } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DsaEvidence } from '../../../../../interfaces/dsa-evidence.interface';
import { DsaService } from '../../../../../services/dsa/dsa/dsa.service';
import { TranslationHelperService } from '../../../../../services/translation-helper.service';
import { AddEvidenceDialogComponent } from '../add-evidence-dialog/add-evidence-dialog.component';
import { HttpResponse } from '@angular/common/http';
import { DisplayMessageService } from '../../../../../services/display-message.service';

@Component({
  selector: 'app-evidence-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './evidence-list.component.html',
  styleUrls: ['./evidence-list.component.css']
})
export class EvidenceListComponent implements OnInit, OnChanges {
  @Input({ required: true }) noticeId!: string;

  private dsa = inject(DsaService);
  private snack = inject(DisplayMessageService);
  private dialog = inject(MatDialog);
  private clipboard = inject(Clipboard);
  readonly i18n = inject(TranslationHelperService);

  loading = signal(false);
  items = signal<DsaEvidence[]>([]);
  busy = signal<Record<string, boolean>>({});

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['noticeId'] && !changes['noticeId'].isFirstChange()) {
      this.load();
    }
  }

  load(): void {
    if (!this.noticeId) return;
    this.loading.set(true);
    this.dsa.getEvidenceForNotice(this.noticeId).subscribe({
      next: rows => this.items.set(rows || []),
      error: () => this.snack.open(this.i18n.t('Could not load evidence.'), this.i18n.t('OK'), { duration: 3000 }),
      complete: () => this.loading.set(false)
    });
  }

  isBusy(id: string): boolean {
    return !!this.busy()[id];
  }

  addScreenshotFromUrl(e: DsaEvidence): void {
    if (e.type !== 'url' || !e.url) return;
    if (!this.noticeId) return;
    if (this.isBusy(e.id)) return;
    this.busy.update(m => ({ ...m, [e.id]: true }));
    this.dsa.addEvidenceScreenshot(this.noticeId, { url: e.url, fullPage: true, viewport: { width: 1280, height: 800 } })
      .subscribe({
        next: () => {
          this.snack.open(this.i18n.t('Screenshot added.'), this.i18n.t('OK'), { duration: 2000 });
          this.load();
        },
        error: () => { /* error snackbar handled in service */ },
        complete: () => this.busy.update(m => ({ ...m, [e.id]: false }))
      });
  }

  labelForType(type: string): string {
    switch (type) {
      case 'file': return this.i18n.t('File upload');
      case 'url': return this.i18n.t('External URL');
      case 'hash': return this.i18n.t('Hash digest');
      default: return type;
    }
  }

  openAdd(): void {
    const ref = this.dialog.open(AddEvidenceDialogComponent, {
      data: { noticeId: this.noticeId },
      width: 'min(560px, 96vw)',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });
    ref.afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  copyUrl(url?: string | null): void {
    if (!url) {
      this.snack.open(this.i18n.t('No URL to copy.'), this.i18n.t('OK'), { duration: 2000 });
      return;
    }
    const ok = this.clipboard.copy(url);
    this.snack.open(this.i18n.t(ok ? 'URL copied to clipboard.' : 'Copy failed.'), this.i18n.t('OK'), { duration: 2000 });
  }

  downloadFile(e: DsaEvidence): void {
    if (e.type !== 'file') return;
    this.dsa.downloadEvidence(e.id).subscribe({
      next: (response: HttpResponse<Blob>) => {
        const blob = response.body;
        if (!blob) {
          this.snack.open(this.i18n.t('Empty file received.'), this.i18n.t('OK'), { duration: 2500 });
          return;
        }
        const filename = this.resolveFilename(response, e.fileName || 'evidence');
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snack.open(this.i18n.t('Could not download evidence.'), this.i18n.t('OK'), { duration: 3000 });
      }
    });
  }

  private resolveFilename(response: HttpResponse<Blob>, fallback: string): string {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) return fallback;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1].replace(/"/g, ''));
      } catch {
        return match[1].replace(/"/g, '');
      }
    }
    return fallback;
  }
}
