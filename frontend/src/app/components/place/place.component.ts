import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogContainer, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { StyleService } from '../../services/style.service';
import { Mode } from '../../interfaces/mode';
import { Place } from '../../interfaces/place';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'app-place',
    imports: [
        MatDialogContainer,
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatDialogActions,
        MatDialogClose,
        MatDialogTitle,
        MatDialogContent,
        MatIcon,
        FormsModule,
        MatFormFieldModule,
        MatInputModule
    ],
    templateUrl: './place.component.html',
    styleUrl: './place.component.css'
})
export class PlaceComponent implements OnInit {

  constructor(
    public dialogRef: MatDialogRef<PlaceComponent>,
    private style: StyleService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, place: Place }
  ) { }

  ngOnInit(): void {
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onAbortClick(): void {
    this.dialogRef.close();
  }

  public showPolicy() {
    this.snackBar.open(`Place id, place name, the added locations and the subscribed flag is saved on our server.`, 'OK', {});
  }

}
