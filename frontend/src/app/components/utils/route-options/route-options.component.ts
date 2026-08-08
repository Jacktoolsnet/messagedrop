import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { TranslocoPipe } from '@jsverse/transloco';
import { RouteOptions, normalizeRouteOptions } from '../../../interfaces/route-options';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

export interface RouteOptionsDialogData {
  options?: RouteOptions;
}

@Component({
  selector: 'app-route-options',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatSlideToggleModule,
    MatSliderModule,
    TranslocoPipe
  ],
  templateUrl: './route-options.component.html',
  styleUrl: './route-options.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RouteOptionsComponent {
  private readonly dialogRef = inject(MatDialogRef<RouteOptionsComponent>);
  private readonly data = inject<RouteOptionsDialogData>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  options = normalizeRouteOptions(this.data.options);

  cancel(): void {
    this.dialogRef.close();
  }

  apply(): void {
    this.dialogRef.close(normalizeRouteOptions(this.options));
  }
}
