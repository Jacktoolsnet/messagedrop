import { NgZone, signal, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { DEFAULT_SPEECH_SETTINGS } from '../../../interfaces/speech-settings';
import { DEFAULT_USAGE_PROTECTION_SETTINGS } from '../../../interfaces/usage-protection-settings';
import { AppService } from '../../../services/app.service';
import { OembedService } from '../../../services/oembed.service';
import { StickerService } from '../../../services/sticker.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ShowmultimediaComponent } from './showmultimedia.component';

describe('ShowmultimediaComponent', () => {
  let component: ShowmultimediaComponent;
  let fixture: ComponentFixture<ShowmultimediaComponent>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let stickerService: jasmine.SpyObj<Pick<StickerService, 'fetchRenderObjectUrl' | 'resolveStickerId'>>;

  function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  beforeEach(async () => {
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    dialog.open.and.returnValue({
      afterClosed: () => of(undefined)
    } as never);
    stickerService = jasmine.createSpyObj<Pick<StickerService, 'fetchRenderObjectUrl' | 'resolveStickerId'>>(
      'StickerService',
      ['fetchRenderObjectUrl', 'resolveStickerId']
    );
    stickerService.fetchRenderObjectUrl.and.resolveTo('');
    stickerService.resolveStickerId.and.returnValue(null);

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
        },
        {
          provide: StickerService,
          useValue: stickerService
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

  it('loads sticker render URLs via the sticker service', async () => {
    const deferred = createDeferred<string>();
    stickerService.resolveStickerId.and.returnValue('sticker-123');
    stickerService.fetchRenderObjectUrl.and.returnValue(deferred.promise);

    component.multimedia = {
      type: MultimediaType.STICKER,
      sourceUrl: 'https://example.com/sticker',
      url: 'https://example.com/sticker',
      contentId: 'sticker-123',
      title: 'Sticker',
      attribution: '',
      description: ''
    };
    component.ngOnChanges({
      multimedia: new SimpleChange(undefined, component.multimedia, true)
    });

    expect(component.stickerImageLoading).toBeTrue();
    expect(stickerService.fetchRenderObjectUrl).toHaveBeenCalledOnceWith('sticker-123', 'preview');

    deferred.resolve('blob:sticker-123');
    await deferred.promise;
    await fixture.whenStable();

    expect(component.getRenderableImageUrl()).toBe('blob:sticker-123');
    expect(component.stickerImageError).toBeFalse();
  });

  it('re-enters Angular zone when the sticker fetch resolves', async () => {
    const deferred = createDeferred<string>();
    const ngZone = TestBed.inject(NgZone);
    const runSpy = spyOn(ngZone, 'run').and.callFake(<T>(fn: (...args: unknown[]) => T) => fn());
    stickerService.resolveStickerId.and.returnValue('sticker-123');
    stickerService.fetchRenderObjectUrl.and.returnValue(deferred.promise);

    component.multimedia = {
      type: MultimediaType.STICKER,
      sourceUrl: 'https://example.com/sticker',
      url: 'https://example.com/sticker',
      contentId: 'sticker-123',
      title: 'Sticker',
      attribution: '',
      description: ''
    };
    component.ngOnChanges({
      multimedia: new SimpleChange(undefined, component.multimedia, true)
    });

    deferred.resolve('blob:sticker-123');
    await deferred.promise;
    await fixture.whenStable();

    expect(runSpy).toHaveBeenCalled();
  });

  it('revokes the sticker object URL immediately after load', async () => {
    const revokeSpy = spyOn(URL, 'revokeObjectURL');
    stickerService.resolveStickerId.and.returnValue('sticker-123');
    stickerService.fetchRenderObjectUrl.and.resolveTo('blob:sticker-123');

    component.multimedia = {
      type: MultimediaType.STICKER,
      sourceUrl: 'https://example.com/sticker',
      url: 'https://example.com/sticker',
      contentId: 'sticker-123',
      title: 'Sticker',
      attribution: '',
      description: ''
    };
    component.ngOnChanges({
      multimedia: new SimpleChange(undefined, component.multimedia, true)
    });

    await fixture.whenStable();

    component.onStickerImageLoaded();
    expect(component.stickerImageLoading).toBeFalse();
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:sticker-123');

    component.ngOnDestroy();
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });
});
