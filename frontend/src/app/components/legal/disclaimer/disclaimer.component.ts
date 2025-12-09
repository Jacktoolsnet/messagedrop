
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AppService } from '../../../services/app.service';

@Component({
  selector: 'app-disclaimer',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatSlideToggleModule
],
  templateUrl: './disclaimer.component.html',
  styleUrl: './disclaimer.component.css'
})
export class DisclaimerComponent implements OnInit {
  accepted = false;

  private dialogRef = inject(MatDialogRef<DisclaimerComponent>);
  private appService = inject(AppService);

  ngOnInit(): void {
    // falls bereits zugestimmt wurde, Toggle vorbefüllen
    const settings = this.appService.getAppSettings();
    this.accepted = !!settings?.consentSettings?.disclaimer;
  }

  onToggle(val: boolean) {
    const current = this.appService.getAppSettings();
    current.consentSettings.disclaimer = val;
    this.appService.setAppSettings(current);
    this.dialogRef.close(val);
  }

}