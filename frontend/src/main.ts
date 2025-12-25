import { provideZoneChangeDetection, isDevMode } from "@angular/core";
import { registerLocaleData } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { registerLaunchHandler } from './app/utils/launch-manager';

import localeAr from '@angular/common/locales/ar';
import localeDe from '@angular/common/locales/de';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import localeHi from '@angular/common/locales/hi';
import localeJa from '@angular/common/locales/ja';
import localeKo from '@angular/common/locales/ko';
import localePt from '@angular/common/locales/pt';
import localeRu from '@angular/common/locales/ru';
import localeZh from '@angular/common/locales/zh';
import { provideHttpClient } from '@angular/common/http';
import { TranslocoHttpLoader } from './transloco-loader';
import { provideTransloco } from '@jsverse/transloco';

registerLocaleData(localeDe);
registerLocaleData(localeFr);
registerLocaleData(localeEs);
registerLocaleData(localeZh);
registerLocaleData(localeHi);
registerLocaleData(localeRu);
registerLocaleData(localeAr);
registerLocaleData(localePt);
registerLocaleData(localeJa);
registerLocaleData(localeKo);

if ('serviceWorker' in navigator) {
navigator.serviceWorker.register('/messagedrop-service-worker.js', {
    scope: '/',
    type: 'classic' // wichtig: nicht module!
  })
    .then(() => console.info('Share-handler service worker registered'))
    .catch(err => console.warn('Failed to register share-handler service worker', err));
}

bootstrapApplication(AppComponent, {...appConfig, providers: [provideZoneChangeDetection(), ...appConfig.providers, provideHttpClient(), provideTransloco({
        config: { 
          availableLangs: ['en', 'de'],
          defaultLang: 'en',
          // Remove this option if your application doesn't support changing language in runtime.
          reRenderOnLangChange: true,
          prodMode: !isDevMode(),
        },
        loader: TranslocoHttpLoader
      })]})
  .then(appRef => {
    const injector = appRef.injector;
    registerLaunchHandler(injector);
  })
  .catch((err) => console.error(err));
