import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { User } from '../../../interfaces/user.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user/user.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { CreateUserComponent } from '../../user/create-user/create-user.component';
import { EditUserComponent, EditUserData } from '../../user/edit-user/edit-user.component';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
  ]
})
export class UserDashboardComponent {
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  readonly i18n = inject(TranslationHelperService);

  readonly users = this.userService.users;
  readonly username = this.authService.username;
  readonly role = this.authService.role;

  constructor() {
    this.userService.loadUsers();
  }

  openCreateUserDialog() {
    this.dialog.open(CreateUserComponent, {
      panelClass: 'glass-dialog'
    })
      .afterClosed()
      .subscribe((created) => {
        if (created) this.userService.loadUsers(); // refresh list
      });
  }

  confirmDelete(user: User) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete user?',
        message: this.i18n.t('Do you really want to delete “{{username}}”? This cannot be undone.', {
          username: user.username
        }),
        confirmText: 'Delete',
        cancelText: 'Cancel',
        warn: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.userService.deleteUser(user.id).subscribe({
        next: (res) => {
          if (res?.deleted) {
            this.snack.open(this.i18n.t('User “{{username}}” deleted.', { username: user.username }), this.i18n.t('OK'), { duration: 2500 });
            this.userService.loadUsers(); // refresh
          } else {
            this.snack.open(this.i18n.t('Delete failed.'), this.i18n.t('OK'), { duration: 2500 });
          }
        },
        error: (err) => {
          if (err?.status === 403) {
            this.snack.open(this.i18n.t('Insufficient permissions to delete users.'), this.i18n.t('OK'), { duration: 3000 });
          } else {
            this.snack.open(this.i18n.t('Backend error while deleting user.'), this.i18n.t('OK'), { duration: 3000 });
          }
        }
      });
    });
  }

  isAdminOrRoot(): boolean {
    return ['admin', 'root'].includes(this.role()!);
  }

  canDelete(user: User): boolean {
    const me = this.username();
    return this.isAdminOrRoot() && !!me && user.username !== me;
  }

  isSelf(user: User): boolean {
    return user.username === this.username();
  }

  canEdit(user: User): boolean {
    return this.isAdminOrRoot() || this.isSelf(user);
  }

  openEditUserDialog(user: User) {
    const isAdminOrRoot = this.isAdminOrRoot();
    const isSelf = this.isSelf(user);
    const data: EditUserData = {
      user,
      canChangeUsername: isAdminOrRoot,
      canChangeEmail: isAdminOrRoot || isSelf,
      canChangeRole: isAdminOrRoot,
      isSelf
    };
    const ref = this.dialog.open(EditUserComponent, { data });
    ref.afterClosed().subscribe((updated) => {
      if (updated) this.userService.loadUsers();
    });
  }

  roleLabel(role: string | null | undefined): string {
    switch (role) {
      case 'root':
        return this.i18n.t('Root');
      case 'admin':
        return this.i18n.t('Admin');
      case 'legal':
        return this.i18n.t('Legal');
      case 'editor':
        return this.i18n.t('Editor');
      case 'author':
        return this.i18n.t('Author');
      case 'moderator':
        return this.i18n.t('Moderator');
      default:
        return role || '';
    }
  }
}
