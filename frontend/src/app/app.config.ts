import { ApplicationConfig, isDevMode, LOCALE_ID } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth-interceptor';
import { loadingInterceptor } from './interceptors/loading-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: navigator.language },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor])
    ),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })]
};
