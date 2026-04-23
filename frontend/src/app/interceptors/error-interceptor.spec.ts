import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiErrorService } from '../services/api-error.service';
import { DiagnosticLoggerService } from '../services/diagnostic-logger.service';
import { NetworkService } from '../services/network.service';
import { TranslationHelperService } from '../services/translation-helper.service';
import { errorInterceptor } from './error-interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let dialog: { open: jasmine.Spy };
  let networkService: {
    isOnline: jasmine.Spy;
    getErrorMessage: jasmine.Spy;
    getErrorTitle: jasmine.Spy;
    getErrorIcon: jasmine.Spy;
    requestBackendCheck: jasmine.Spy;
    recordBackendMaintenance: jasmine.Spy;
    recordBackendReachable: jasmine.Spy;
    maintenanceInfo: jasmine.Spy;
    backendOnline: jasmine.Spy;
  };

  beforeEach(() => {
    dialog = {
      open: jasmine.createSpy('open').and.returnValue({
        afterClosed: () => of(undefined)
      })
    };

    networkService = {
      isOnline: jasmine.createSpy('isOnline').and.returnValue(false),
      getErrorMessage: jasmine.createSpy('getErrorMessage').and.returnValue('offline-message'),
      getErrorTitle: jasmine.createSpy('getErrorTitle').and.returnValue('offline-title'),
      getErrorIcon: jasmine.createSpy('getErrorIcon').and.returnValue('wifi_off'),
      requestBackendCheck: jasmine.createSpy('requestBackendCheck'),
      recordBackendMaintenance: jasmine.createSpy('recordBackendMaintenance'),
      recordBackendReachable: jasmine.createSpy('recordBackendReachable'),
      maintenanceInfo: jasmine.createSpy('maintenanceInfo').and.returnValue(null),
      backendOnline: jasmine.createSpy('backendOnline').and.returnValue(true)
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: dialog },
        { provide: ApiErrorService, useValue: { getErrorMessage: () => null } },
        { provide: NetworkService, useValue: networkService },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        { provide: DiagnosticLoggerService, useValue: { logHttpError: jasmine.createSpy('logHttpError') } }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('suppresses gateway-timeout dialogs while offline status is already visible', () => {
    http.get(`${environment.apiUrl}/weather/de/test/1/2/3`).subscribe({
      next: () => fail('expected an error'),
      error: () => {
        // expected
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/weather/de/test/1/2/3`);
    req.flush(
      { status: 504, errorCode: 'GATEWAY_TIMEOUT' },
      { status: 504, statusText: 'Gateway Timeout' }
    );

    expect(networkService.requestBackendCheck).toHaveBeenCalledWith(true);
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
