import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

@Component({
  selector: 'app-tile-delete',
  standalone: true,
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogTitle, MatDialogContent],
  templateUrl: './tile-delete.component.html',
  styleUrl: './tile-delete.component.css'
})
export class TileDeleteComponent {
  readonly dialogRef = inject(MatDialogRef<TileDeleteComponent>);
}
