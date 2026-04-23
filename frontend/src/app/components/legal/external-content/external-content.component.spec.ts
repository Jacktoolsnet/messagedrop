import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppSettings } from '../../../interfaces/app-settings';
import { DEFAULT_PIN_INPUT_FEEDBACK_SETTINGS } from '../../../interfaces/pin-input-feedback-settings';
import { DEFAULT_SPEECH_SETTINGS } from '../../../interfaces/speech-settings';
import { DEFAULT_USAGE_PROTECTION_SETTINGS } from '../../../interfaces/usage-protection-settings';
import { AppService } from '../../../services/app.service';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { ExternalContentComponent } from './external-content.component';

describe('ExternalContentComponent', () => {
  let component: ExternalContentComponent;
  let fixture: ComponentFixture<ExternalContentComponent>;
  let appService: jasmine.SpyObj<AppService>;

  const appSettings: AppSettings = {
    languageMode: 'de',
    language: 'de',
    defaultTheme: 'azure',
    themeMode: 'system',
    detectLocationOnStart: false,
    persistStorage: false,
    enablePinterestContent: false,
    enableSpotifyContent: false,
    enableTenorContent: false,
    enableUnsplashContent: false,
    enableTikTokContent: false,
    enableYoutubeContent: false,
    diagnosticLogging: false,
    backupOnExit: false,
    pinInputFeedback: { ...DEFAULT_PIN_INPUT_FEEDBACK_SETTINGS },
    speech: { ...DEFAULT_SPEECH_SETTINGS },
    usageProtection: { ...DEFAULT_USAGE_PROTECTION_SETTINGS },
    consentSettings: {
      disclaimer: false,
      privacyPolicy: false,
      termsOfService: false,
      ageAdultConfirmed: false,
      ageMinorWithParentalConsentConfirmed: false
    },
    legalVersion: 1
  };

  beforeEach(async () => {
    appService = jasmine.createSpyObj<AppService>('AppService', ['setAppSettings']);
    appService.setAppSettings.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [ExternalContentComponent],
      providers: [
        { provide: AppService, useValue: appService },
        { provide: MatDialogRef, useValue: jasmine.createSpyObj('MatDialogRef', ['close']) },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            appSettings,
            visiblePlatforms: ['youtube']
          }
        },
        { provide: HelpDialogService, useValue: jasmine.createSpyObj('HelpDialogService', ['open']) }
      ]
    })
      .overrideComponent(ExternalContentComponent, {
        set: { template: '' }
      })
      .compileComponents();

    fixture = TestBed.createComponent(ExternalContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows only requested platforms for contextual dialogs', () => {
    expect(component.visiblePlatforms).toEqual(['youtube']);
  });

  it('updates the matching setting generically', () => {
    component.setPlatformEnabled('youtube', true);

    expect(component.appSettings.enableYoutubeContent).toBeTrue();
    expect(component.appSettings.enableSpotifyContent).toBeFalse();
  });

  it('persists the edited settings on apply', async () => {
    component.setPlatformEnabled('youtube', true);

    await component.onApplyClick();

    expect(appService.setAppSettings).toHaveBeenCalledWith(jasmine.objectContaining({
      enableYoutubeContent: true
    }));
  });
});
