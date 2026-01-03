
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-user',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './user.component.html',
  styleUrl: './user.component.css'
})
export class UserComponent {
  private snackBarRef?: MatSnackBarRef<SimpleSnackBar>;
  public connectHint = '';
  readonly userService = inject(UserService);
  private readonly dialogRef = inject(MatDialogRef<UserComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);

  public showPolicy(): void {
    this.snackBarRef = this.snackBar.open(
      this.translation.t('common.user.serverInfoHint'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

  public triggerAction(action: string): void {
    this.dialogRef.close({ action });
  }

}
