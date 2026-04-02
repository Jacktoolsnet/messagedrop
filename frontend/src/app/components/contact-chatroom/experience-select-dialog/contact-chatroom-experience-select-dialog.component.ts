import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExperienceBookmark } from '../../../interfaces/experience-bookmark';
import { ExperienceResult } from '../../../interfaces/viator';
import { ExperienceBookmarkService } from '../../../services/experience-bookmark.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-contact-chatroom-experience-select-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    TranslocoPipe
  ],
  templateUrl: './contact-chatroom-experience-select-dialog.component.html',
  styleUrl: './contact-chatroom-experience-select-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactChatroomExperienceSelectDialogComponent {
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly dialogRef = inject(MatDialogRef<ContactChatroomExperienceSelectDialogComponent, ExperienceResult>);

  readonly experiences = this.bookmarkService.bookmarksSignal;
  readonly hasExperiences = computed(() => this.experiences().length > 0);

  constructor() {
    void this.bookmarkService.ensureLoaded().catch(() => undefined);
  }

  select(bookmark: ExperienceBookmark): void {
    this.dialogRef.close(bookmark.snapshot);
  }

  close(): void {
    this.dialogRef.close();
  }

  getExperienceImage(bookmark: ExperienceBookmark): string | null {
    return bookmark.snapshot.imageUrl || bookmark.snapshot.avatarUrl || null;
  }

  getExperienceTitle(bookmark: ExperienceBookmark): string {
    return bookmark.snapshot.title || bookmark.snapshot.productCode || '';
  }
}
