import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { registerLaunchHandler } from './app/utils/launch-manager';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-share-handler.js', {
    scope: '/',
    type: 'classic' // wichtig: nicht module!
  })
    .then(() => { })
    .catch(err => { });
}

bootstrapApplication(AppComponent, appConfig)
  .then(appRef => {
    const injector = appRef.injector;
    registerLaunchHandler(injector);
  })
  .catch((err) => console.error(err));
