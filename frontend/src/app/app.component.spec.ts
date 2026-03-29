import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Meta, Title } from '@angular/platform-browser';
import { PlatformLocation } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AirQualityService } from './services/air-quality.service';
import { AppService } from './services/app.service';
import { BackupService } from './services/backup.service';
import { BackupStateService } from './services/backup-state.service';
import { ContactMessageService } from './services/contact-message.service';
import { ContactService } from './services/contact.service';
import { DiagnosticLoggerService } from './services/diagnostic-logger.service';
import { DisplayMessageService } from './services/display-message.service';
import { ExperienceBookmarkService } from './services/experience-bookmark.service';
import { ExperienceMapService } from './services/experience-map.service';
import { GeoStatisticService } from './services/geo-statistic.service';
import { GeolocationService } from './services/geolocation.service';
import { HelpDialogService } from './components/utils/help-dialog/help-dialog.service';
import { IndexedDbService } from './services/indexed-db.service';
import { LanguageService } from './services/language.service';
import { LocalDocumentService } from './services/local-document.service';
import { LocalImageService } from './services/local-image.service';
import { MapService } from './services/map.service';
import { MessageService } from './services/message.service';
import { NetworkService } from './services/network.service';
import { NominatimService } from './services/nominatim.service';
import { NoteService } from './services/note.service';
import { OembedService } from './services/oembed.service';
import { PlaceService } from './services/place.service';
import { PowService } from './services/pow.service';
import { RestoreService } from './services/restore.service';
import { ServerService } from './services/server.service';
import { SharedContentService } from './services/shared-content.service';
import { SystemNotificationService } from './services/system-notification.service';
import { TranslationHelperService } from './services/translation-helper.service';
import { UsageProtectionService } from './services/usage-protection.service';
import { UserService } from './services/user.service';
import { WeatherService } from './services/weather.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: AppService,
          useValue: {
            settingsSet: () => 0,
            chekConsentCompleted: () => undefined,
            isConsentCompleted: () => false,
            loadAppSettings: jasmine.createSpy('loadAppSettings').and.resolveTo(),
            notificationAction: () => null,
            clearNotificationAction: jasmine.createSpy('clearNotificationAction'),
            isSettingsReady: () => false,
            getAppSettings: () => ({
              usageProtection: { mode: 'off' },
              backupOnExit: false,
              detectLocationOnStart: false
            })
          }
        },
        { provide: Title, useValue: { setTitle: jasmine.createSpy('setTitle') } },
        { provide: Meta, useValue: { updateTag: jasmine.createSpy('updateTag') } },
        { provide: LOCALE_ID, useValue: 'de-DE' },
        { provide: TranslocoService, useValue: { selectTranslation: () => of({}) } },
        { provide: NetworkService, useValue: { maintenanceInfo: () => null } },
        { provide: SharedContentService, useValue: { getSharedContentSignal: () => signal(null) } },
        { provide: IndexedDbService, useValue: { deleteSetting: jasmine.createSpy('deleteSetting'), getSetting: jasmine.createSpy('getSetting').and.resolveTo(undefined) } },
        { provide: BackupService, useValue: { startBackup: jasmine.createSpy('startBackup') } },
        { provide: RestoreService, useValue: {} },
        { provide: BackupStateService, useValue: { isDirty: () => false, clearDirty: jasmine.createSpy('clearDirty') } },
        { provide: ServerService, useValue: { init: jasmine.createSpy('init') } },
        {
          provide: UserService,
          useValue: {
            initUserId: jasmine.createSpy('initUserId'),
            userSet: () => 0,
            isReady: () => false,
            hasJwt: () => false,
            preloadVapidPublicKey: jasmine.createSpy('preloadVapidPublicKey').and.resolveTo(),
            refreshAccountStatus: jasmine.createSpy('refreshAccountStatus').and.resolveTo(),
            getUser: () => ({ id: 'user-1' }),
            logout: jasmine.createSpy('logout'),
            connectToBackend: jasmine.createSpy('connectToBackend').and.resolveTo()
          }
        },
        { provide: MapService, useValue: { isReady: () => false, initMap: jasmine.createSpy('initMap'), mapSet: () => 0 } },
        { provide: NominatimService, useValue: {} },
        { provide: NoteService, useValue: { logout: jasmine.createSpy('logout'), clearNotes: jasmine.createSpy('clearNotes') } },
        { provide: OembedService, useValue: {} },
        { provide: PlaceService, useValue: { isReady: () => false, initPlaces: jasmine.createSpy('initPlaces'), logout: jasmine.createSpy('logout') } },
        { provide: ContactService, useValue: { initContacts: jasmine.createSpy('initContacts'), contactsSet: () => 0, logout: jasmine.createSpy('logout') } },
        { provide: ContactMessageService, useValue: { initLiveReceive: jasmine.createSpy('initLiveReceive'), unreadCountUpdate: () => null } },
        { provide: SystemNotificationService, useValue: { refreshUnreadCount: jasmine.createSpy('refreshUnreadCount').and.resolveTo(), reset: jasmine.createSpy('reset'), getUnreadCountSignal: () => signal(0) } },
        { provide: GeolocationService, useValue: {} },
        { provide: LocalImageService, useValue: {} },
        { provide: LocalDocumentService, useValue: {} },
        { provide: MessageService, useValue: { messagesSignal: signal([]) } },
        { provide: ExperienceMapService, useValue: {} },
        { provide: ExperienceBookmarkService, useValue: {} },
        { provide: AirQualityService, useValue: {} },
        { provide: WeatherService, useValue: {} },
        { provide: GeoStatisticService, useValue: {} },
        { provide: DiagnosticLoggerService, useValue: {} },
        { provide: DisplayMessageService, useValue: { open: jasmine.createSpy('open') } },
        { provide: MatDialog, useValue: { open: jasmine.createSpy('open') } },
        { provide: PlatformLocation, useValue: { onPopState: jasmine.createSpy('onPopState') } },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } },
        { provide: LanguageService, useValue: { effectiveLanguage: () => 'de' } },
        {
          provide: UsageProtectionService,
          useValue: {
            stopTracking: jasmine.createSpy('stopTracking'),
            startTracking: jasmine.createSpy('startTracking'),
            isLocked: () => false,
            init: jasmine.createSpy('init').and.resolveTo()
          }
        },
        { provide: PowService, useValue: {} }
      ]
    })
      .overrideComponent(AppComponent, {
        set: {
          template: '<div></div>'
        }
      })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
