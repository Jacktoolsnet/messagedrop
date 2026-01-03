import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app.component';
import { appConfig } from './app/app.config';

localStorage.removeItem('admin_token');

bootstrapApplication(App, appConfig)
  .catch(err => console.error(err));
