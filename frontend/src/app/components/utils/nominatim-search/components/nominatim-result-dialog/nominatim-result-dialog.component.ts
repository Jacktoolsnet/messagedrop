import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { NominatimPlace } from '../../../../../interfaces/nominatim-place';
import { HelpDialogService } from '../../../help-dialog/help-dialog.service';
import { NominatimResultItemComponent } from '../nominatim-result-item/nominatim-result-item.component';

interface NominatimResultDialogActions {
  add: (place: NominatimPlace) => void;
  flyTo: (place: NominatimPlace) => void;
  navigate: (place: NominatimPlace) => void;
  apply: (place: NominatimPlace) => void;
}

interface NominatimResultDialogData {
  place: NominatimPlace;
  showAddButton: boolean;
  actions: NominatimResultDialogActions;
}

@Component({
  selector: 'app-nominatim-result-dialog',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatIcon,
    TranslocoPipe,
    NominatimResultItemComponent
  ],
  templateUrl: './nominatim-result-dialog.component.html',
  styleUrl: './nominatim-result-dialog.component.css'
})
export class NominatimResultDialogComponent {
  readonly dialogRef = inject(MatDialogRef<NominatimResultDialogComponent>);
  readonly data = inject<NominatimResultDialogData>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);

  onAdd(place: NominatimPlace): void {
    this.data.actions?.add(place);
  }

  onFlyTo(place: NominatimPlace): void {
    this.data.actions?.flyTo(place);
    this.dialogRef.close();
  }

  onNavigate(place: NominatimPlace): void {
    this.data.actions?.navigate(place);
  }

  onApply(place: NominatimPlace): void {
    this.data.actions?.apply(place);
    this.dialogRef.close();
  }
}
