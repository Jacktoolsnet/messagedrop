import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader, TranslocoLoaderData } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string, data?: TranslocoLoaderData) {
    const langName = lang.split('/').pop() ?? lang;
    const fileName = data?.scope ? `${data.scope}.json` : 'common.json';
    return this.http.get<Translation>(`/assets/i18n/${langName}/${fileName}`);
  }
}
