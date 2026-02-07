
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-user',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatCardModule,
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
  readonly help = inject(HelpDialogService);
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

  public openHelp(): void {
    this.help.open('user', { hasJwt: this.userService.hasJwt() });
  }

}
