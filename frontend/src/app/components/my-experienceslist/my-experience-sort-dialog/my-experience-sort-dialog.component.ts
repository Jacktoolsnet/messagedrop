import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExperienceBookmark } from '../../../interfaces/experience-bookmark';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';

interface MyExperienceSortDialogData {
  bookmarks: ExperienceBookmark[];
}

interface MyExperienceSortDialogResult {
  orderedProductCodes: string[];
}

@Component({
  selector: 'app-my-experience-sort-dialog',
  imports: [
    DialogHeaderComponent,
    CommonModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    TranslocoPipe
  ],
  templateUrl: './my-experience-sort-dialog.component.html',
  styleUrl: './my-experience-sort-dialog.component.css'
})
export class MyExperienceSortDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MyExperienceSortDialogComponent>);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  private readonly data = inject<MyExperienceSortDialogData>(MAT_DIALOG_DATA);
  readonly bookmarks = signal<ExperienceBookmark[]>([...this.data.bookmarks]);

  drop(event: CdkDragDrop<ExperienceBookmark[]>) {
    const updated = [...this.bookmarks()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.bookmarks.set(updated);
  }

  getExperienceName(bookmark: ExperienceBookmark): string {
    return bookmark.snapshot.title?.trim() || bookmark.productCode || this.translation.t('common.experiences.title');
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    const orderedProductCodes = this.bookmarks().map((bookmark) => bookmark.productCode).filter(Boolean);
    this.dialogRef.close({ orderedProductCodes } as MyExperienceSortDialogResult);
  }
}
