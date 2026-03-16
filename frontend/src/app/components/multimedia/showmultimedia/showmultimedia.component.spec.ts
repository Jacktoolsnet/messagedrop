import { signal, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { DEFAULT_SPEECH_SETTINGS } from '../../../interfaces/speech-settings';
import { DEFAULT_USAGE_PROTECTION_SETTINGS } from '../../../interfaces/usage-protection-settings';
import { AppService } from '../../../services/app.service';
import { OembedService } from '../../../services/oembed.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ShowmultimediaComponent } from './showmultimedia.component';

describe('ShowmultimediaComponent', () => {
  let component: ShowmultimediaComponent;
  let fixture: ComponentFixture<ShowmultimediaComponent>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.returnValue({
      afterClosed: () => of(undefined)
    } as never);

    await TestBed.configureTestingModule({
      imports: [ShowmultimediaComponent],
      providers: [
        { provide: MatDialog, useValue: dialog },
        {
          provide: AppService,
          useValue: {
            settingsSet: signal(0).asReadonly(),
            getAppSettings: () => ({
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
            })
          }
        },
        {
          provide: OembedService,
          useValue: {
            isAllowedOembedSource: () => true
          }
        },
        {
          provide: TranslationHelperService,
          useValue: {
            t: (_key: string, params?: { platform?: string }) => params?.platform ?? ''
          }
        }
      ]
    })
      .overrideComponent(ShowmultimediaComponent, {
        set: { template: '' }
      })
      .compileComponents();

    fixture = TestBed.createComponent(ShowmultimediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens the external content dialog filtered to the current provider', () => {
    component.multimedia = {
      type: MultimediaType.YOUTUBE,
      sourceUrl: 'https://www.youtube.com/watch?v=test',
      url: 'https://www.youtube.com/watch?v=test',
      contentId: 'test',
      title: 'Test',
      attribution: '',
      description: '',
      oembed: {
        type: 'video',
        html: '<iframe></iframe>',
        provider_url: 'https://www.youtube.com/',
        version: '1.0'
      }
    };
    component.ngOnChanges({
      multimedia: new SimpleChange(undefined, component.multimedia, true)
    });

    component.openExternalContentSettings();

    expect(dialog.open).toHaveBeenCalled();
    const dialogConfig = dialog.open.calls.mostRecent().args[1] as {
      data: { visiblePlatforms?: string[] };
    };

    expect(dialogConfig.data.visiblePlatforms).toEqual(['youtube']);
  });
});
