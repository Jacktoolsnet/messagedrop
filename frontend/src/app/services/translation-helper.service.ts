import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class TranslationHelperService {
  private readonly transloco = inject(TranslocoService);

  t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }
}
