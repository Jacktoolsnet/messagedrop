import { ApplicationConfig, ErrorHandler, inject, isDevMode, LOCALE_ID, provideAppInitializer } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco } from '@jsverse/transloco';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth-interceptor';
import { errorInterceptor } from './interceptors/error-interceptor';
import { loadingInterceptor } from './interceptors/loading-interceptor';
import { traceIdInterceptor } from './interceptors/trace-id-interceptor';
import { LanguageService } from './services/language.service';
import { DiagnosticLoggerService } from './services/diagnostic-logger.service';
import { GlobalErrorHandler } from './services/global-error-handler';
import { TranslocoHttpLoader } from '../transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => {
      inject(LanguageService);
      inject(DiagnosticLoggerService).initGlobalHandlers();
    }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    { provide: LOCALE_ID, useFactory: () => inject(LanguageService).effectiveLanguage() },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    provideHttpClient(
      withFetch(),
      withInterceptors([traceIdInterceptor, authInterceptor, loadingInterceptor, errorInterceptor])
    ),
    provideTransloco({
      config: {
        // To add more languages later: create assets/i18n/{lang}/common.json + settings.json,
        // then add the language here and in LanguageService.SUPPORTED_LANGS.
        availableLangs: ['en', 'de', 'es', 'fr'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        scopes: {
          autoPrefixKeys: false
        },
        missingHandler: {
          useFallbackTranslation: true
        },
        prodMode: !isDevMode()
      },
      loader: TranslocoHttpLoader
    }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideServiceWorker('messagedrop-service-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately'
    })]
};
