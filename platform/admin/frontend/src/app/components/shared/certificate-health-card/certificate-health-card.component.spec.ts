import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CertificateHealthCardComponent } from './certificate-health-card.component';
import { CertificateHealthService } from '../../../services/certificate-health.service';
import { DisplayMessageService } from '../../../services/display-message.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

const mockOverview = {
  status: 200,
  summary: {
    enabled: true,
    configuredTargets: 1,
    total: 1,
    ok: 1,
    warning: 0,
    critical: 0,
    expired: 0,
    error: 0,
    worstStatus: 'ok' as const,
    lastCheckedAt: Date.now()
  },
  targets: [
    {
      targetKey: 'example.com:443',
      label: 'Public frontend',
      source: 'ORIGIN',
      host: 'example.com',
      port: 443,
      origin: 'https://example.com',
      status: 'ok' as const,
      statusMessage: 'Certificate is valid.',
      authorizationError: null,
      subject: 'CN=example.com',
      subjectAltName: 'DNS:example.com',
      issuer: 'CN=Example Issuer',
      validFrom: Date.now(),
      validTo: Date.now() + 86400000,
      daysRemaining: 1,
      lastCheckedAt: Date.now(),
      updatedAt: Date.now()
    }
  ]
};

describe('CertificateHealthCardComponent', () => {
  let component: CertificateHealthCardComponent;
  let fixture: ComponentFixture<CertificateHealthCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateHealthCardComponent],
      providers: [
        {
          provide: CertificateHealthService,
          useValue: {
            getOverview: () => of(mockOverview),
            runCheck: () => of(mockOverview)
          }
        },
        {
          provide: DisplayMessageService,
          useValue: {
            open: () => void 0
          }
        },
        {
          provide: TranslationHelperService,
          useValue: {
            t: (key: string, params?: Record<string, unknown>) => {
              if (!params) {
                return key;
              }
              return key.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token: string) => String(params[token] ?? ''));
            },
            dateLocale: () => 'en-US'
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CertificateHealthCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the monitored origin', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('https://example.com');
  });
});
