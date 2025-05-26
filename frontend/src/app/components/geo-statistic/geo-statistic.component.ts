import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { GeoStatistic } from '../../interfaces/geo-statistic';

@Component({
  selector: 'app-geo-statistic',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './geo-statistic.component.html',
  styleUrl: './geo-statistic.component.css'
})
export class GeoStatisticComponent {
  public geoStatistic: GeoStatistic | undefined = undefined
  constructor(
    public dialogRef: MatDialogRef<GeoStatisticComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { geoStatistic: GeoStatistic }
  ) {
    this.geoStatistic = data.geoStatistic;
  }
}
