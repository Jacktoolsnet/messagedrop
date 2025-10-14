import { Clipboard } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaEvidence } from '../../../../../interfaces/dsa-evidence.interface';
import { DsaService } from '../../../../../services/dsa/dsa/dsa.service';
import { AddEvidenceDialogComponent } from '../add-evidence-dialog/add-evidence-dialog.component';
import { HttpResponse } from '@angular/common/http';

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
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private clipboard = inject(Clipboard);

  loading = signal(false);
  items = signal<DsaEvidence[]>([]);

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
      error: () => this.snack.open('Could not load evidence.', 'OK', { duration: 3000 }),
      complete: () => this.loading.set(false)
    });
  }

  labelForType(type: string): string {
    switch (type) {
      case 'file': return 'File upload';
      case 'url': return 'External URL';
      case 'hash': return 'Hash digest';
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
      this.snack.open('No URL to copy.', 'OK', { duration: 2000 });
      return;
    }
    const ok = this.clipboard.copy(url);
    this.snack.open(ok ? 'URL copied to clipboard.' : 'Copy failed.', 'OK', { duration: 2000 });
  }

  downloadFile(e: DsaEvidence): void {
    if (e.type !== 'file') return;
    this.dsa.downloadEvidence(e.id).subscribe({
      next: (response: HttpResponse<Blob>) => {
        const blob = response.body;
        if (!blob) {
          this.snack.open('Empty file received.', 'OK', { duration: 2500 });
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
        this.snack.open('Could not download evidence.', 'OK', { duration: 3000 });
      }
    });
  }

  private resolveFilename(response: HttpResponse<Blob>, fallback: string): string {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) return fallback;
    const match = /filename\*?=(?:UTF-8'')?\"?([^\";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1].replace(/\"/g, ''));
      } catch {
        return match[1].replace(/\"/g, '');
      }
    }
    return fallback;
  }
}
