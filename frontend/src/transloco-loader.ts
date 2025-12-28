import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader, TranslocoLoaderData } from '@jsverse/transloco';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string, data?: TranslocoLoaderData) {
    const langName = (lang.split('/').pop() ?? lang).split('-')[0];
    const fileName = data?.scope ? `${data.scope}.json` : 'common.json';
    const url = `/assets/i18n/${langName}/${fileName}`;
    const fallbackUrl = `/assets/i18n/en/${fileName}`;
    return this.http.get<Translation>(url).pipe(
      catchError(() => (langName === 'en'
        ? of({} as Translation)
        : this.http.get<Translation>(fallbackUrl)))
    );
  }
}
