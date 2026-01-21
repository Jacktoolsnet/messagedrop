import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mode } from '../../../interfaces/mode';
import { Place } from '../../../interfaces/place';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { PlaceProfileComponent } from '../place-settings/place-settings.component';

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
  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  private readonly data = inject<PlaceSortDialogData>(MAT_DIALOG_DATA);
  readonly places = signal<Place[]>([...this.data.places]);

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

  openPlaceSettings(place: Place): void {
    const dialogRef = this.dialog.open(PlaceProfileComponent, {
      panelClass: '',
      data: { mode: Mode.EDIT_PLACE, place },
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.placeService.updatePlace(place)
        .subscribe({
          next: (response) => {
            if (response.status === 200) {
              this.placeService.saveAdditionalPlaceInfos(place);
              this.places.set([...this.places()]);
            }
          },
          error: (err) => {
            this.snackBar.open(err?.message ?? this.translation.t('common.actions.ok'), this.translation.t('common.actions.ok'));
          }
        });
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    const orderedIds = this.places().map(place => place.id);
    this.dialogRef.close({ orderedIds } as PlaceSortDialogResult);
  }
}
