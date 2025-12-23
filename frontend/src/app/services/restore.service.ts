import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class RestoreService {
  private readonly snackBar = inject(MatSnackBar);

  startRestore(): void {
    this.snackBar.open('Restore is not implemented yet.', undefined, {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
