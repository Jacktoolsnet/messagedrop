import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-data-sources',
  standalone: true,
  imports: [DialogHeaderComponent, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './data-sources.component.html',
  styleUrl: './data-sources.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataSourcesComponent {
  private readonly dialogRef = inject(MatDialogRef<DataSourcesComponent>);
  readonly geodataExportUrl = `${environment.geodataServiceUrl}/geodata/exports`;

  close(): void {
    this.dialogRef.close();
  }
}
