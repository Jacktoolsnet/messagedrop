import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AppService } from '../../../services/app.service';
import { DisclaimerComponent } from '../disclaimer/disclaimer.component';

@Component({
  selector: 'app-privacy-policy',
  imports: [
    CommonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatSlideToggleModule
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css'
})
export class PrivacyPolicyComponent implements OnInit {
  accepted = false;

  private dialogRef = inject(MatDialogRef<DisclaimerComponent>);
  private appService = inject(AppService);

  ngOnInit(): void {
    // falls bereits zugestimmt wurde, Toggle vorbefüllen
    const settings = this.appService.getAppSettings();
    this.accepted = !!settings?.consentSettings?.privacyPolicy;
  }

  onToggle(val: boolean) {
    const current = this.appService.getAppSettings();
    current.consentSettings.privacyPolicy = val;
    this.appService.setAppSettings(current);
    this.dialogRef.close(val);
  }

}
