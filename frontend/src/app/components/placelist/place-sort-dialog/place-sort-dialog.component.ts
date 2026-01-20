import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Place } from '../../../interfaces/place';
import { TranslationHelperService } from '../../../services/translation-helper.service';

interface PlaceSortDialogData {
  places: Place[];
}

interface PlaceSortDialogResult {
  orderedIds: string[];
}

@Component({
  selector: 'app-place-sort-dialog',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    TranslocoPipe
  ],
  templateUrl: './place-sort-dialog.component.html',
  styleUrl: './place-sort-dialog.component.css'
})
export class PlaceSortDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PlaceSortDialogComponent>);
  private readonly translation = inject(TranslationHelperService);
  private readonly data = inject<PlaceSortDialogData>(MAT_DIALOG_DATA);
  readonly places = signal<Place[]>(this.data.places.map(place => ({ ...place })));

  drop(event: CdkDragDrop<Place[]>) {
    const updated = [...this.places()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.places.set(updated);
  }

  getPlaceName(place: Place): string {
    return place.name?.trim() || this.translation.t('common.placeList.nameFallback');
  }

  getPlaceIcon(place: Place): string {
    return place.icon || 'location';
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    const orderedIds = this.places().map(place => place.id);
    this.dialogRef.close({ orderedIds } as PlaceSortDialogResult);
  }
}
