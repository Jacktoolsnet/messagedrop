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
}
