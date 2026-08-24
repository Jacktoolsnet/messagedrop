import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { AppService } from './app.service';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  it('waits for the active translations during initialization', async () => {
    const translations = new Subject<Record<string, unknown>>();
    const transloco = jasmine.createSpyObj<TranslocoService>('TranslocoService', [
      'load',
      'setActiveLang'
    ]);
    transloco.load.and.returnValue(translations);

    TestBed.configureTestingModule({
      providers: [
        LanguageService,
        { provide: TranslocoService, useValue: transloco },
        {
          provide: AppService,
          useValue: {
            settingsSet: signal(0),
            isSettingsReady: () => false,
            getAppSettings: () => ({ languageMode: 'system' }),
            setAppSettings: () => Promise.resolve()
          }
        }
      ]
    });

    const service = TestBed.inject(LanguageService);
    let initialized = false;
    const initialization = service.init().then(() => {
      initialized = true;
    });

    await Promise.resolve();
    expect(initialized).toBeFalse();
    expect(transloco.load).toHaveBeenCalledWith(service.effectiveLanguage());

    translations.next({});
    translations.complete();
    await initialization;

    expect(initialized).toBeTrue();
  });
});
