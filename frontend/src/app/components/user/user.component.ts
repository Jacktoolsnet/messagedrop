
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { HelpDialogComponent, HelpDialogData, HelpItem } from '../utils/help-dialog/help-dialog.component';

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
  private readonly dialog = inject(MatDialog);
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
    const items: HelpItem[] = [
      {
        icon: 'badge',
        titleKey: 'user.items.userId.title',
        descriptionKey: 'user.items.userId.desc'
      },
      {
        icon: 'download',
        titleKey: 'user.items.backup.title',
        descriptionKey: 'user.items.backup.desc'
      },
      {
        icon: 'lock_reset',
        titleKey: 'user.items.changePin.title',
        descriptionKey: 'user.items.changePin.desc'
      }
    ];

    if (this.userService.hasJwt()) {
      items.push({
        icon: 'security',
        titleKey: 'user.items.resetKeys.title',
        descriptionKey: 'user.items.resetKeys.desc'
      });
    }

    items.push({
      icon: 'delete',
      titleKey: 'user.items.delete.title',
      descriptionKey: 'user.items.delete.desc'
    });

    const data: HelpDialogData = {
      titleKey: 'user.title',
      introKey: 'user.intro',
      items
    };

    this.dialog.open(HelpDialogComponent, {
      data,
      minWidth: 'min(520px, 95vw)',
      maxWidth: '95vw',
      width: 'min(680px, 95vw)',
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true,
      autoFocus: false
    });
  }

}
