import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MessageService } from './message.service';
import { GeolocationService } from './geolocation.service';
import { IndexedDbService } from './indexed-db.service';
import { MapService } from './map.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

describe('MessageService', () => {
  let service: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: MapService, useValue: {} },
        { provide: GeolocationService, useValue: {} },
        { provide: NetworkService, useValue: { setNetworkMessageConfig: jasmine.createSpy('setNetworkMessageConfig') } },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        {
          provide: IndexedDbService,
          useValue: {
            getOwnPublicMessages: jasmine.createSpy('getOwnPublicMessages').and.resolveTo([]),
            setOwnPublicMessages: jasmine.createSpy('setOwnPublicMessages').and.resolveTo()
          }
        }
      ]
    });
    service = TestBed.inject(MessageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should flag automated moderation rejections as blocked for republishing', () => {
    expect(service.isRejectedByAutomatedModeration({ aiModerationDecision: 'rejected' })).toBeTrue();
    expect(service.isRejectedByAutomatedModeration({ patternMatch: true })).toBeTrue();
  });

  it('should allow manually approved messages despite earlier automated findings', () => {
    expect(service.isRejectedByAutomatedModeration({
      aiModerationDecision: 'rejected',
      patternMatch: true,
      manualModerationDecision: 'approved'
    })).toBeFalse();
  });

  it('should detect UUIDs without hyphens as private data', () => {
    expect(service.detectPersonalInformation('123e4567e89b12d3a456426614174000')).toBeTrue();
  });

  it('should detect UUIDs with spaces or newlines as private data', () => {
    expect(service.detectPersonalInformation('123e4567 e89b 12d3 a456 426614174000')).toBeTrue();
    expect(service.detectPersonalInformation('123e4567\ne89b\n12d3\na456\n426614174000')).toBeTrue();
  });

  it('should detect UUIDs with tabs, repeated spaces, and mixed separators as private data', () => {
    expect(service.detectPersonalInformation('123e4567\t\t e89b  12d3\t a456\t426614174000')).toBeTrue();
    expect(service.detectPersonalInformation('123e4567_e89b.12d3/a456:426614174000')).toBeTrue();
  });
});
