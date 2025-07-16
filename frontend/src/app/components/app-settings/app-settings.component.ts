import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppSettings } from '../../interfaces/app-settings';
import { AppService } from '../../services/app.service';
import { ProfileComponent } from '../user/profile/profile.component';

@Component({
  selector: 'app-app-settings',
  imports: [
    CommonModule,
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
  ],
  templateUrl: './app-settings.component.html',
  styleUrl: './app-settings.component.css'
})
export class AppSettingsComponent {
  public availableThemes = [
    'azure',
    'blue',
    'chartreuse',
    'cyan',
    'green',
    'magenta',
    'orange',
    'red',
    'rose',
    'spring-green',
    'violet',
    'yellow'
  ];
  public appSettings: AppSettings = { defaultTheme: 'azure', themeMode: 'system' };

  constructor(
    private appService: AppService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ProfileComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { appSettings: AppSettings }
  ) {
    this.appSettings = this.data.appSettings;
  }

  onAbortClick(): void {
    this.dialogRef.close();
  }

  setTheme(themeName: string): void {
    this.appSettings.defaultTheme = themeName;
    this.appService.setTheme(this.appSettings);
  }

  setThemeMode(mode: 'light' | 'dark' | 'system') {
    this.appSettings.themeMode = mode;
    this.appService.setTheme(this.appSettings);
  }

}
