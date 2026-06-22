import { MatDialogRef } from '@angular/material/dialog';

/** Saves a dialog when it is dismissed implicitly; explicit action buttons remain unaffected. */
export function saveDialogOnImplicitDismiss<T>(dialogRef: MatDialogRef<T>, save: () => void): void {
  dialogRef.backdropClick().subscribe(() => save());
  dialogRef.keydownEvents().subscribe(event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    save();
  });
}
