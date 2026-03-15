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
});
