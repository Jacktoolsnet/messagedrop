
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Profile } from '../../../interfaces/profile';
import { StyleService } from '../../../services/style.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    TranslocoPipe
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css'
})
export class UserProfileComponent {
  private readonly maxFileSizeMb = 5;
  private readonly maxFileSize = this.maxFileSizeMb * 1024 * 1024;
  private oriProfile: Profile;

  readonly userService = inject(UserService);
  private readonly styleService = inject(StyleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<UserProfileComponent>);

  constructor() {
    this.oriProfile = structuredClone(this.userService.getProfile());
  }

  onAbortClick(): void {
    Object.assign(this.userService.getProfile(), this.oriProfile);
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(this.translation.t('common.user.profile.fileTypeInvalid'), this.translation.t('common.actions.ok'), {
        duration: 2000
      });
      return;
    }

    if (file.size > this.maxFileSize) {
      this.snackBar.open(
        this.translation.t('common.user.profile.fileTooLarge', { maxSizeMb: this.maxFileSizeMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.userService.getProfile().base64Avatar = (e.target as FileReader).result as string;
    };
    reader.onerror = () => {
      this.snackBar.open(this.translation.t('common.user.profile.fileReadError'), this.translation.t('common.actions.ok'), {
        duration: 2000
      });
    };

    reader.readAsDataURL(file);
  }

  deleteAvatar(): void {
    this.userService.getProfile().base64Avatar = '';
  }

  showPolicy(): void {
    this.snackBar.open(this.translation.t('common.user.profile.policyHint'), this.translation.t('common.actions.ok'), {
      duration: 4000
    });
  }

  changeDefaultStyle(): void {
    this.userService.getProfile().defaultStyle = this.styleService.getRandomStyle();
  }
}
