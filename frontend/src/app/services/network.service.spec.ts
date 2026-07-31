import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { DisplayMessageConfig } from '../interfaces/display-message-config';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

describe('NetworkService', () => {
  let service: NetworkService;
  let onlineSpy: jasmine.Spy;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(() => {
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {
          provide: MatDialog,
          useValue: dialog
        },
        {
          provide: TranslationHelperService,
          useValue: {
            t: (key: string) => key
          }
        }
      ]
    });
    service = TestBed.inject(NetworkService);
    onlineSpy = spyOnProperty(window.navigator, 'onLine', 'get').and.returnValue(true);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns offline messaging for gateway timeouts when the browser is offline', () => {
    onlineSpy.and.returnValue(false);

    expect(service.getErrorTitle(504)).toBe('errors.offline.title');
    expect(service.getErrorMessage(504)).toBe('errors.offline.message');
    expect(service.getErrorIcon(504)).toBe('wifi_off');
  });

  it('keeps gateway timeout messaging when the browser is online', () => {
    expect(service.getErrorTitle(504)).toBe('errors.http.title.gatewayTimeout');
    expect(service.getErrorMessage(504)).toBe('errors.http.message.gatewayTimeout');
    expect(service.getErrorIcon(504)).toBe('hourglass_disabled');
  });

  it('uses readable fallback copy when translations are not loaded yet', () => {
    const previousLanguageMode = localStorage.getItem('messagedrop.language');
    localStorage.setItem('messagedrop.language', 'de');

    (service as unknown as { openBrowserOfflineDialog: () => void }).openBrowserOfflineDialog();

    const config = dialog.open.calls.mostRecent().args[1];
    const data = config?.data as DisplayMessageConfig | undefined;
    expect(data?.title).toBe('Keine Internetverbindung');
    expect(data?.message).toBe('Bitte überprüfe deine Internetverbindung.');
    expect(data?.button).toBe('OK');
    if (previousLanguageMode === null) {
      localStorage.removeItem('messagedrop.language');
    } else {
      localStorage.setItem('messagedrop.language', previousLanguageMode);
    }
  });
});
