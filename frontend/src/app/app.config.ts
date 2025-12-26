import { ApplicationConfig, inject, isDevMode, LOCALE_ID, provideAppInitializer } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth-interceptor';
import { loadingInterceptor } from './interceptors/loading-interceptor';
import { LanguageService } from './services/language.service';
import { TranslocoHttpLoader } from '../transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => {
      inject(LanguageService);
    }),
    { provide: LOCALE_ID, useFactory: () => inject(LanguageService).effectiveLanguage() },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor])
    ),
    provideTransloco({
      config: {
        availableLangs: ['en', 'de'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        missingHandler: {
          useFallbackTranslation: true
        },
        prodMode: !isDevMode()
      },
      loader: TranslocoHttpLoader
    }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })]
};
