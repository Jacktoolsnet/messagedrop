import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { formatDate, PlatformLocation } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, LOCALE_ID, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Meta, Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AirQualityComponent } from './components/air-quality/air-quality.component';
import { AppSettingsComponent } from './components/app-settings/app-settings.component';
import { ContactlistComponent } from './components/contactlist/contactlist.component';
import { DocumentlistComponent } from './components/documentlist/documentlist.component';
import { EditMessageComponent } from './components/editmessage/edit-message.component';
import { EditNoteComponent } from './components/editnote/edit-note.component';
import { GeoStatisticComponent } from './components/geo-statistic/geo-statistic.component';
import { ImagelistComponent } from './components/imagelist/imagelist.component';
import { OverrideExifDataComponent } from './components/imagelist/override-exif-data/override-exif-data.component';
import { ConsentGateComponent } from './components/legal/consent-gate/consent-gate.component';
import { DisclaimerComponent } from './components/legal/disclaimer/disclaimer.component';
import { ExternalContentComponent } from './components/legal/external-content/external-content.component';
import { LegalNoticeComponent } from './components/legal/legal-notice/legal-notice.component';
import { PrivacyPolicyComponent } from './components/legal/privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from './components/legal/terms-of-service/terms-of-service.component';
import { ThirdPartyLicensesComponent } from './components/legal/third-party-licenses/third-party-licenses.component';
import { MapComponent } from './components/map/map.component';
import { MultiMarkerComponent } from './components/map/multi-marker/multi-marker.component';
import { MessagelistComponent } from './components/messagelist/messagelist.component';
import { NotelistComponent } from './components/notelist/notelist.component';
import { PlacelistComponent } from './components/placelist/placelist.component';
import { SharedContentComponent } from './components/shared-content/shared-content.component';
import { SystemMessageDialogComponent } from './components/system-messages/system-message-dialog/system-message-dialog.component';
import { DeleteUserComponent } from './components/user/delete-user/delete-user.component';
import { UserProfileComponent } from './components/user/user-profile/user-profile.component';
import { UserComponent } from './components/user/user.component';
import { DisplayMessage } from './components/utils/display-message/display-message.component';
import { NominatimSearchComponent } from './components/utils/nominatim-search/nominatim-search.component';
import { WeatherComponent } from './components/weather/weather.component';
import { GetGeoStatisticResponse } from './interfaces/get-geo-statistic-response';
import { LocalDocument } from './interfaces/local-document';
import { LocalImage } from './interfaces/local-image';
import { Location } from './interfaces/location';
import { MarkerLocation } from './interfaces/marker-location';
import { MarkerType } from './interfaces/marker-type';
import { Message } from './interfaces/message';
import { MaintenanceInfo } from './interfaces/maintenance';
import { Mode } from './interfaces/mode';
import { Multimedia } from './interfaces/multimedia';
import { MultimediaType } from './interfaces/multimedia-type';
import { NominatimPlace } from './interfaces/nominatim-place';
import { Note } from './interfaces/note';
import { NotificationAction } from './interfaces/notification-action';
import { Place } from './interfaces/place';
import { PlusCodeArea } from './interfaces/plus-code-area';
import { SharedContent } from './interfaces/shared-content';
import { ShortNumberPipe } from './pipes/short-number.pipe';
import { AirQualityService } from './services/air-quality.service';
import { AppService } from './services/app.service';
import { BackupStateService } from './services/backup-state.service';
import { BackupService } from './services/backup.service';
import { ContactMessageService } from './services/contact-message.service';
import { ContactService } from './services/contact.service';
import { GeoStatisticService } from './services/geo-statistic.service';
import { GeolocationService } from './services/geolocation.service';
import { IndexedDbService } from './services/indexed-db.service';
import { LanguageService } from './services/language.service';
import { LocalDocumentService } from './services/local-document.service';
import { LocalImageService } from './services/local-image.service';
import { MapService } from './services/map.service';
import { MessageService } from './services/message.service';
import { NetworkService } from './services/network.service';
import { NoteService } from './services/note.service';
import { OembedService } from './services/oembed.service';
import { PlaceService } from './services/place.service';
import { PowService } from './services/pow.service';
import { RestoreService } from './services/restore.service';
import { ServerService } from './services/server.service';
import { SharedContentService } from './services/shared-content.service';
import { SystemNotificationService } from './services/system-notification.service';
import { TranslationHelperService } from './services/translation-helper.service';
import { UserService } from './services/user.service';
import { WeatherService } from './services/weather.service';
import { isQuotaExceededError } from './utils/storage-error.util';

@Component({
  selector: 'app-root',
  imports: [
    ConsentGateComponent,
    MatBadgeModule,
    RouterOutlet,
    TranslocoPipe,
    MapComponent,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    ShortNumberPipe,
    MatMenuModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [
    trigger('badgePulse', [
      transition('* => *', [
        animate('1s ease-in-out', keyframes([
          style({ transform: 'scale(1) rotate(0deg)', offset: 0 }),
          style({ transform: 'scale(1.18) rotate(-10deg)', offset: 0.1 }),
          style({ transform: 'scale(0.9) rotate(10deg)', offset: 0.2 }),
          style({ transform: 'scale(1.16) rotate(-8deg)', offset: 0.3 }),
          style({ transform: 'scale(0.94) rotate(8deg)', offset: 0.4 }),
          style({ transform: 'scale(1.1) rotate(-6deg)', offset: 0.55 }),
          style({ transform: 'scale(0.96) rotate(6deg)', offset: 0.7 }),
          style({ transform: 'scale(1.04) rotate(-3deg)', offset: 0.85 }),
          style({ transform: 'scale(1) rotate(0deg)', offset: 1 })
        ]))
      ])
    ])
  ]
})

export class AppComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  locationReady = false;
  public myHistory: string[] = [];
  public markerLocations = new Map<string, MarkerLocation>();
  private snackBarRef?: MatSnackBarRef<unknown>;
  isUserLocation = false;
  initWatchingPosition = false;
  public mode: typeof Mode = Mode;
  lastMarkerUpdate = 0;
  locationSubscriptionError = false;
  isPartOfPlace = false;

  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  readonly appService = inject(AppService);
  readonly networkService = inject(NetworkService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly backupService = inject(BackupService);
  private readonly restoreService = inject(RestoreService);
  private readonly backupState = inject(BackupStateService);
  readonly serverService = inject(ServerService);
  readonly userService = inject(UserService);
  readonly mapService = inject(MapService);
  readonly noteService = inject(NoteService);
  private readonly oembedService = inject(OembedService);
  readonly placeService = inject(PlaceService);
  readonly contactService = inject(ContactService);
  private readonly contactMessageService = inject(ContactMessageService);
  readonly systemNotificationService = inject(SystemNotificationService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly localImageService = inject(LocalImageService);
  private readonly localDocumentService = inject(LocalDocumentService);
  private readonly messageService = inject(MessageService);
  private readonly airQualityService = inject(AirQualityService);
  private readonly weatherService = inject(WeatherService);
  private readonly geoStatisticService = inject(GeoStatisticService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly platformLocation = inject(PlatformLocation);
  private readonly translation = inject(TranslationHelperService);
  private readonly languageService = inject(LanguageService);
  private readonly locale = inject<string>(LOCALE_ID);
  readonly powService = inject(PowService);
  private exitBackupPromptPending = false;
  private exitBackupDialogOpen = false;
  private exitBackupPromptTimer?: ReturnType<typeof setTimeout>;
  private exitBackupUnloadInProgress = false;
  readonly userMessagesSignal = computed(() =>
    this.messageService.messagesSignal().filter(
      msg => msg.userId === this.userService.getUser().id
    )
  );
  readonly unreadSystemNotificationCount = this.systemNotificationService.getUnreadCountSignal();
  readonly hasUnreadSystemNotifications = computed(() => this.unreadSystemNotificationCount() > 0);
  readonly unreadContactCounts = signal<Record<string, number>>({});
  readonly unreadContactsTotal = computed(() =>
    Object.values(this.unreadContactCounts()).reduce((acc, val) => acc + (val || 0), 0)
  );
  readonly unreadTotalAll = computed(() => this.unreadContactsTotal() + this.unreadSystemNotificationCount());
  readonly maintenanceActive = computed(() => this.networkService.maintenanceInfo()?.enabled ?? false);
  readonly animateUserBadgeTick = signal<number>(0);
  private lastUnreadTotal = 0;
  private badgeAnimationTimer?: ReturnType<typeof setTimeout>;
  private badgeAnimationRunning = false;
  private lastLiveMessageId?: string;

  constructor() {
    this.setupExitBackupPrompt();
    effect(async () => {
      this.appService.settingsSet(); // <-- track changes
      this.appService.chekConsentCompleted();
      if (this.appService.isConsentCompleted()) {
        // Clear cache
        this.indexedDbService.deleteSetting('nominatimSelectedPlace')
        this.indexedDbService.deleteSetting('nominatimSearch')
        if (!this.mapService.isReady()) {
          this.mapService.initMap();
        }
        // Init the server connection
        this.serverService.init();
        // Get user id if avaliable
        this.userService.initUserId();
      } else {
        this.logout();
      }
    });

    effect(() => {
      const mapSetTrigger = this.mapService.mapSet(); // <-- track changes
      if (this.appService.isConsentCompleted() && mapSetTrigger === 1) {
        /**
         * Only on app init.
         * Fly to position if user alrady allowed location.
         */
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          if (result.state === 'granted' && this.appService.getAppSettings().detectLocationOnStart) {
            this.getCurrentPosition();
          } else {
            this.updateDataForLocation();
          }
        });
      }
    });

    effect(() => {
      this.userService.userSet(); // <-- track changes
      if (this.appService.isConsentCompleted()) {
        if (this.userService.isReady()) {
          this.contactService.initContacts(this.userService.hasJwt());
          if (!this.placeService.isReady()) {
            this.placeService.initPlaces();
          }
          if (this.userService.hasJwt()) {
            this.contactMessageService.initLiveReceive();
            void this.systemNotificationService.refreshUnreadCount();
          } else {
            this.systemNotificationService.reset();
          }
        } else {
          this.systemNotificationService.reset();
        }
      } else {
        this.systemNotificationService.reset();
      }
    });

    effect(() => {
      this.contactService.contactsSet(); // track changes for unread badge
      if (this.appService.isConsentCompleted() && this.userService.hasJwt()) {
        this.refreshContactUnreadCounts();
      } else {
        this.unreadContactCounts.set({});
        this.resetBadgeAnimation();
      }
    });

    effect(() => {
      const update = this.contactMessageService.unreadCountUpdate();
      if (update) {
        this.unreadContactCounts.update((map) => ({ ...map, [update.contactId]: update.unread }));
      }
    });

    effect(() => {
      if (!this.userService.hasJwt() || !this.appService.isConsentCompleted()) {
        this.resetBadgeAnimation();
        this.lastUnreadTotal = 0;
        return;
      }
      const total = this.unreadTotalAll();
      if (total > this.lastUnreadTotal && !this.badgeAnimationRunning) {
        this.triggerBadgeAnimation();
      }
      this.lastUnreadTotal = total;
      if (total === 0) {
        this.resetBadgeAnimation();
      }
    });

    effect(() => {
      const incoming = this.contactMessageService.liveMessages();
      if (!incoming || !this.userService.hasJwt() || !this.appService.isConsentCompleted()) {
        return;
      }
      if (incoming.id !== this.lastLiveMessageId && incoming.direction === 'contactUser') {
        this.lastLiveMessageId = incoming.id;
        this.triggerBadgeAnimation();
      }
    });

    effect(() => {
      this.messageService.messageSet(); // <-- track changes
      if (this.appService.isConsentCompleted()) {
        this.createMarkerLocations();
      }
    });

    // Shared Content
    effect(() => {
      const content = this.sharedContentService.getSharedContentSignal()();
      if (content && this.appService.isConsentCompleted()) {
        this.handleSharedContent(content);
      }
    });

    this.initApp();
    // Notification Action
    this.handleNotification();
  }

  async initApp() {
    await this.appService.loadAppSettings();
  }

  public ngOnInit(): void {
    this.transloco.selectTranslation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((translation) => {
        const meta = translation?.['common']?.['meta'];
        if (!meta) {
          return;
        }

        // Title
        this.titleService.setTitle(meta.title ?? '');

        // Meta tags
        this.metaService.updateTag({ name: 'description', content: meta.description ?? '' });
        this.metaService.updateTag({ name: 'keywords', content: meta.keywords ?? '' });
        this.metaService.updateTag({ name: 'robots', content: 'index, follow' });

        // Open Graph / Twitter
        this.metaService.updateTag({ property: 'og:title', content: meta.ogTitle ?? '' });
        this.metaService.updateTag({ property: 'og:description', content: meta.ogDescription ?? '' });
        this.metaService.updateTag({ property: 'og:image', content: 'https://messagedrop.de/icons/icon-512x512.png' });

        this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
        this.metaService.updateTag({ name: 'twitter:title', content: meta.twitterTitle ?? '' });
        this.metaService.updateTag({ name: 'twitter:description', content: meta.twitterDescription ?? '' });
      });
    // Handle back button
    this.platformLocation.onPopState(() => {
      if (this.myHistory.length > 0) {
        this.myHistory.pop();
        window.history.pushState(this.myHistory, '', '');
      } else {
        //No "history" - let them exit or keep them in the app.
      }
    });
    window.history.pushState(this.myHistory, '', '');
  }

  public logout() {
    this.userService.logout()
    this.placeService.logout();
    this.contactService.logout();
    this.noteService.logout();
    this.systemNotificationService.reset();
    this.resetBadgeAnimation();
  }

  public connectToBackend(): void {
    void this.userService.connectToBackend();
  }

  private refreshContactUnreadCounts(): void {
    const contacts = this.contactService.sortedContactsSignal();
    if (!contacts?.length) {
      this.unreadContactCounts.set({});
      return;
    }
    this.unreadContactCounts.set({});
    contacts.forEach((contact) => {
      this.contactMessageService.unreadCount(contact.id).subscribe({
        next: (res) => {
          this.unreadContactCounts.update((map) => ({ ...map, [contact.id]: res.unread ?? 0 }));
        },
        error: () => {
          // best effort for badge; ignore errors
        }
      });
    });
  }

  private setupExitBackupPrompt(): void {
    const cancelExitBackupPrompt = () => {
      this.exitBackupUnloadInProgress = true;
      this.exitBackupPromptPending = false;
      if (this.exitBackupPromptTimer) {
        clearTimeout(this.exitBackupPromptTimer);
        this.exitBackupPromptTimer = undefined;
      }
    };

    window.addEventListener('pagehide', cancelExitBackupPrompt);
    window.addEventListener('unload', cancelExitBackupPrompt);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        cancelExitBackupPrompt();
      }
    });

    window.addEventListener('beforeunload', (event) => {
      if (!this.shouldPromptBackupOnExit()) {
        return;
      }
      this.exitBackupUnloadInProgress = false;
      this.exitBackupPromptPending = true;
      event.preventDefault();
      event.returnValue = '';
      if (this.exitBackupPromptTimer) {
        clearTimeout(this.exitBackupPromptTimer);
      }
      this.exitBackupPromptTimer = setTimeout(() => {
        if (!this.exitBackupPromptPending) {
          return;
        }
        if (
          this.exitBackupUnloadInProgress
          || document.visibilityState !== 'visible'
          || !document.hasFocus()
        ) {
          return;
        }
        this.exitBackupPromptPending = false;
        this.exitBackupPromptTimer = undefined;
        this.openExitBackupDialog();
      }, 1000);
    });
  }

  private shouldPromptBackupOnExit(): boolean {
    const settings = this.appService.getAppSettings();
    return settings.backupOnExit === true
      && this.userService.isReady()
      && this.backupState.isDirty();
  }

  private openExitBackupDialog(): void {
    if (this.exitBackupDialogOpen || !this.shouldPromptBackupOnExit()) {
      return;
    }
    this.exitBackupDialogOpen = true;
    const dialogRef = this.dialog.open(DeleteUserComponent, {
      data: {
        title: this.translation.t('common.backupExit.title'),
        message: this.translation.t('common.backupExit.message'),
        confirmLabel: this.translation.t('common.actions.backupNow'),
        cancelLabel: this.translation.t('common.actions.no')
      },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      this.exitBackupDialogOpen = false;
      if (result === true) {
        this.backupService.startBackup();
      } else if (result === false) {
        this.backupState.clearDirty();
      }
    });
  }

  getContactsBadge(): string {
    const total = this.unreadContactsTotal();
    if (!total) {
      return '';
    }
    return total > 99 ? '99+' : `${total}`;
  }

  private async handleSharedContent(content: SharedContent) {
    let multimedia: Multimedia | undefined = undefined;
    let location: Location | undefined = undefined;

    if (content.url) {
      const objectFromUrl = await this.oembedService.getObjectFromUrl(content.url);
      if (this.oembedService.isMultimedia(objectFromUrl)) {
        multimedia = objectFromUrl;
      } else if (this.oembedService.isLocation(objectFromUrl)) {
        location = objectFromUrl;
      } else {
        this.snackBar.open(JSON.stringify(content, null, 2), this.translation.t('common.actions.ok'), {
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    }

    const dialogRef = this.dialog.open(SharedContentComponent, {
      data: { multimedia, location },
      closeOnNavigation: true,
      minWidth: 'min(450px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.saveProfile();
      }
    });
  }

  public handleNotification() {
    const notificationAction: NotificationAction | undefined = this.appService.getNotificationAction();
    if (notificationAction) {
      this.snackBar.open(
        this.translation.t('common.notifications.received', { action: notificationAction }),
        this.translation.t('common.actions.ok')
      );
      // z. B. Navigation starten, Dialog öffnen, etc.
      void this.systemNotificationService.refreshUnreadCount();
    }
  }

  private formatMaintenanceTimestamp(seconds: number | null | undefined): string | null {
    if (!seconds) {
      return null;
    }
    return formatDate(seconds * 1000, 'medium', this.locale);
  }

  private getMaintenanceReason(maintenance: MaintenanceInfo): string | null {
    const lang = this.languageService.effectiveLanguage();
    if (lang === 'en') {
      return maintenance.reasonEn || maintenance.reason;
    }
    if (lang === 'es') {
      return maintenance.reasonEs || maintenance.reason;
    }
    if (lang === 'fr') {
      return maintenance.reasonFr || maintenance.reason;
    }
    return maintenance.reason || maintenance.reasonEn || maintenance.reasonEs || maintenance.reasonFr;
  }

  private buildMaintenanceMessage(maintenance: MaintenanceInfo): string {
    const details: string[] = [];
    const startsAt = this.formatMaintenanceTimestamp(maintenance.startsAt);
    const endsAt = this.formatMaintenanceTimestamp(maintenance.endsAt);
    const reason = this.getMaintenanceReason(maintenance);

    if (startsAt) {
      details.push(`${this.translation.t('common.maintenance.start')}: ${startsAt}`);
    }
    if (endsAt) {
      details.push(`${this.translation.t('common.maintenance.end')}: ${endsAt}`);
    }
    if (reason) {
      details.push(`${this.translation.t('common.maintenance.reason')}: ${reason}`);
    }

    const baseMessage = this.translation.t('common.maintenance.message');
    if (!details.length) {
      return baseMessage;
    }
    return `${baseMessage}\n\n${details.join('\n')}`;
  }

  public showBackendOfflineInfo(): void {
    const maintenance = this.networkService.maintenanceInfo();
    if (maintenance?.enabled) {
      this.dialog.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: this.translation.t('common.maintenance.title'),
          image: '',
          icon: 'construction',
          message: this.buildMaintenanceMessage(maintenance),
          button: this.translation.t('common.actions.ok'),
          delay: 0,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        autoFocus: false
      });
      return;
    }
    this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.serverDown.title'),
        image: '',
        icon: 'cloud_off',
        message: this.translation.t('common.serverDown.message'),
        button: this.translation.t('common.actions.ok'),
        delay: 0,
        showSpinner: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });
  }

  public loadLocalDataAfterLogin(): void {
    this.updateDataForLocation();
  }

  private setIsUserLocation(): void {
    if (this.userService.getUser().location.plusCode === this.mapService.getMapLocation().plusCode) {
      this.isUserLocation = true;
    } else {
      this.isUserLocation = false;
    }
  }

  public getCurrentPosition() {
    const dialogRef = this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.location.locatingTitle'),
        image: '',
        icon: 'place',
        message: this.translation.t('common.location.locatingMessage'),
        button: '',
        delay: 0,
        showSpinner: true
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.geolocationService.getCurrentPosition().subscribe({
        next: (position) => {
          dialogRef.close();
          this.locationReady = true;
          this.userService.getUser().location.latitude = position.coords.latitude;
          this.userService.getUser().location.longitude = position.coords.longitude;
          this.userService.getUser().location.plusCode = this.geolocationService.getPlusCode(position.coords.latitude, position.coords.longitude)
          if (this.userService.isReady()) {
            this.userService.saveUser();
          }
          this.mapService.moveToWithZoom(this.userService.getUser().location, 17);
          this.updateDataForLocation();
        },
        error: (error) => {
          dialogRef.close();
          this.locationReady = false;
          if (error.code == 1) {
            this.snackBarRef = this.snackBar.open(this.translation.t('common.location.authorizationRequired'), this.translation.t('common.actions.ok'), {
              panelClass: ['snack-info'],
              horizontalPosition: 'center',
              verticalPosition: 'top',
              duration: 1000
            });
          } else {
            this.snackBarRef = this.snackBar.open(this.translation.t('common.location.failed'), this.translation.t('common.actions.ok'), {
              panelClass: ['snack-info'],
              horizontalPosition: 'center',
              verticalPosition: 'top',
              duration: 1000
            });
          }
        }
      });
    });

    dialogRef.afterClosed().subscribe(() => {
      // Optional: Aktionen nach Schließen
    });
  }

  private async updateDataForLocation() {
    // Clear markerLocations
    this.markerLocations.clear()
    // notes from local device
    if (this.userService.isReady()) {
      await this.noteService.getNotesInBoundingBox(this.mapService.getVisibleMapBoundingBox());
      await this.localImageService.getImagesInBoundingBox(this.mapService.getVisibleMapBoundingBox());
      await this.localDocumentService.getDocumentsInBoundingBox(this.mapService.getVisibleMapBoundingBox());
    }
    // Messages
    this.messageService.getByVisibleMapBoundingBox();
  }

  public handleMoveEndEvent() {
    this.updateDataForLocation();
    this.setIsUserLocation();
  }

  public handleMarkerClickEvent(event: MarkerLocation) {
    switch (event.type) {
      case MarkerType.PUBLIC_MESSAGE:
        this.messageService.setMessages(event.messages)
        this.openMarkerMessageListDialog(event.messages);
        break;
      case MarkerType.PRIVATE_NOTE:
        if (this.userService.isReady()) {
          this.noteService.getNotesInBoundingBox(this.mapService.getVisibleMapBoundingBox()).then(() => {
            this.openMarkerNoteListDialog(event.notes);
          });
        }
        break;
      case MarkerType.PRIVATE_IMAGE:
        if (this.userService.isReady()) {
          this.localImageService.getImagesInBoundingBox(this.mapService.getVisibleMapBoundingBox()).then(() => {
            this.openMarkerImageListDialog(event.images);
          });
        }
        break;
      case MarkerType.PRIVATE_DOCUMENT:
        if (this.userService.isReady()) {
          this.localDocumentService.getDocumentsInBoundingBox(this.mapService.getVisibleMapBoundingBox()).then(() => {
            this.openMarkerDocumentListDialog(event.documents);
          });
        }
        break;
      case MarkerType.MULTI:
        this.openMarkerMultiDialog(event.messages, event.notes, event.images, event.documents);
        break;
    }
  }

  public handleClickEvent(event: Location) {
    this.mapService.moveTo(event);
  }

  async openMessagDialog(): Promise<void> {
    const message: Message = {
      id: 0,
      uuid: crypto.randomUUID(),
      parentId: 0,
      parentUuid: '',
      typ: 'public',
      createDateTime: null,
      deleteDateTime: null,
      location: this.mapService.getMapLocation(),
      message: '',
      markerType: 'default',
      style: '',
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: [],
      commentsNumber: 0,
      status: 'enabled',
      userId: '',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };
    this.sharedContentService.addSharedContentToMessage(message);

    const dialogRef = this.dialog.open(EditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, message: message },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("messageDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: { mode: Mode, message: Message }) => {
      if (data) {
        this.messageService.createMessage(data.message, this.userService.getUser());
        this.updateDataForLocation();
      }
    });
  }

  async openNoteDialog(): Promise<void> {
    const note: Note = {
      id: '',
      location: this.mapService.getMapLocation(),
      note: '',
      markerType: 'note',
      style: '',
      timestamp: 0,
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };
    this.sharedContentService.addSharedContentToNote(note);
    const dialogRef = this.dialog.open(EditNoteComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_NOTE, user: this.userService.getUser(), note: note },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("noteDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: { mode: Mode, note: Note }) => {
      if (undefined !== data?.note) {
        data.note.location.latitude = this.mapService.getMapLocation().latitude;
        data.note.location.longitude = this.mapService.getMapLocation().longitude;
        data.note.location.plusCode = this.mapService.getMapLocation().plusCode;
        this.noteService.addNote(data.note);
        this.updateDataForLocation();
      }
    });
  }

  async openAddImageDialog(): Promise<void> {
    if (!this.localImageService.isSupported()) {
      this.snackBar.open(this.translation.t('common.files.pickerUnsupported'), undefined, { duration: 4000 });
      return;
    }

    try {
      const entries = await this.localImageService.createImageEntries(this.mapService.getMapLocation());

      if (!entries.length) {
        return;
      }

      const resolvedEntries = await this.resolveExifOverrides(entries);

      await Promise.all(resolvedEntries.map(entry => this.indexedDbService.saveImage(entry)));
      this.snackBar.open(this.translation.t('common.images.imported'), undefined, { duration: 3000 });
      this.updateDataForLocation();
    } catch (error) {
      console.error('Failed to add image', error);
      this.snackBar.open(this.translation.t('common.images.importFailed'), undefined, { duration: 4000 });
    }
  }

  async openAddDocumentDialog(): Promise<void> {
    if (!this.localDocumentService.isSupported()) {
      this.snackBar.open(this.translation.t('common.documents.pickerUnsupported'), undefined, { duration: 4000 });
      return;
    }

    try {
      const entries = await this.localDocumentService.createDocumentEntries(this.mapService.getMapLocation());

      if (!entries.length) {
        return;
      }

      await Promise.all(entries.map(entry => this.localDocumentService.saveDocument(entry)));
      this.snackBar.open(this.translation.t('common.documents.imported'), undefined, { duration: 3000 });
      this.updateDataForLocation();
    } catch (error) {
      console.error('Failed to add document', error);
      const message = isQuotaExceededError(error)
        ? this.translation.t('common.documents.storageFull')
        : this.translation.t('common.documents.importFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
    }
  }

  private async resolveExifOverrides(entries: LocalImage[]): Promise<LocalImage[]> {
    let rememberedChoice: boolean | null = null; // null = ask; true = use map; false = keep exif

    const result: LocalImage[] = [];

    for (const entry of entries) {
      if (entry.hasExifLocation && entry.location && rememberedChoice === null) {
        const previewUrl = await this.localImageService.getImageUrl(entry).catch(() => undefined);
        const dialogResult = await firstValueFrom(
          this.dialog.open(OverrideExifDataComponent, {
            data: { fileName: entry.fileName, previewUrl },
            autoFocus: false,
          }).afterClosed()
        );

        const useMap = dialogResult?.useMap === true;
        if (dialogResult?.applyToAll) {
          rememberedChoice = useMap;
        }

        if (useMap) {
          entry.location = this.mapService.getMapLocation();
          entry.hasExifLocation = false;
        }
      } else if (entry.hasExifLocation && entry.location && rememberedChoice === true) {
        entry.location = this.mapService.getMapLocation();
        entry.hasExifLocation = false;
      }

      result.push(entry);
    }

    return result;
  }


  public openSystemMessages(): void {
    if (!this.userService.hasJwt()) {
      return;
    }

    const dialogRef = this.dialog.open(SystemMessageDialogComponent, {
      closeOnNavigation: true,
      minHeight: '90vh',
      maxHeight: '90vh',
      minWidth: '90vw',
      maxWidth: '90vw',
      autoFocus: false,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(() => {
      void this.systemNotificationService.refreshUnreadCount();
    });
  }

  public openUserMessagListDialog(): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    this.userService.getUserMessages(this.userService.getUser())
      .subscribe({
        next: (getMessageResponse) => {
          this.messageService.setMessages(this.messageService.mapRawMessages(getMessageResponse.rows));
          const dialogRef = this.dialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { location: this.mapService.getMapLocation() },
            minWidth: 'min(450px, 95vw)',
            maxWidth: '95vw',
            width: 'auto',
            maxHeight: '95vh',
            height: 'auto',
            hasBackdrop: true,
            autoFocus: false
          });

          dialogRef.afterOpened().subscribe(() => {
            this.myHistory.push("userMessageList");
            window.history.replaceState(this.myHistory, '', '');
          });

          dialogRef.afterClosed().subscribe(() => {
            this.messageService.clearSelectedMessages();
            this.messageService.getByVisibleMapBoundingBox();
          });
        },
        error: () => {
          this.messageService.clearMessages();
          const dialogRef = this.dialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { location: this.mapService.getMapLocation() },
            minWidth: 'min(450px, 95vw)',
            maxWidth: '95vw',
            width: 'auto',
            maxHeight: 'none',
            height: 'auto',
            hasBackdrop: true,
            autoFocus: false
          });

          dialogRef.afterOpened().subscribe(() => {
            this.myHistory.push("userMessageList");
            window.history.replaceState(this.myHistory, '', '');
          });

          dialogRef.afterClosed().subscribe(() => {
            this.messageService.clearSelectedMessages();
            this.updateDataForLocation();
          });
        }
      });
  }

  public openNoteListDialog(): void {
    this.noteService.loadNotes().then(() => {
      const dialogRef = this.dialog.open(NotelistComponent, {
        panelClass: 'NoteListDialog',
        closeOnNavigation: true,
        data: { location: this.mapService.getMapLocation(), notesSignal: this.noteService.getNotesWritableSignal() },
        minWidth: 'min(450px, 95vw)',
        maxWidth: '95vw',
        width: 'auto',
        maxHeight: 'none',
        height: 'auto',
        hasBackdrop: true,
        autoFocus: false
      });

      dialogRef.afterOpened().subscribe(() => {
        this.myHistory.push("userNoteList");
        window.history.replaceState(this.myHistory, '', '');
      });

      dialogRef.afterClosed().subscribe(() => {
        this.updateDataForLocation();
      });
    });
  }

  public openPlaceListDialog(): void {
    const placeCount = this.placeService.isReady() ? this.placeService.getPlaces().length : 0;
    const hasPlaces = placeCount > 0;
    const dialogWidth = placeCount > 1 ? 'min(900px, 95vw)' : 'min(520px, 95vw)';
    const dialogRef = this.dialog.open(PlacelistComponent, {
      panelClass: hasPlaces ? 'PalceListDialog' : undefined,
      closeOnNavigation: true,
      data: {},
      minWidth: 'min(360px, 95vw)',
      maxWidth: '95vw',
      width: dialogWidth,
      maxHeight: '95vh',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("placeList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((places: Place[]) => {
      if (places && this.userService.hasJwt()) {
        places.forEach(place => {
          this.placeService.updatePlace(place).subscribe({
            next: simpleResponse => {
              if (simpleResponse.status === 200) {
                this.placeService.saveAdditionalPlaceInfos(place);
              }
            }
          });
        });
      }
      this.updateDataForLocation();
    });
  }

  public openContactListDialog(): void {
    const contactCount = this.contactService.isReady() ? this.contactService.contactsSignal().length : 0;
    const hasContacts = contactCount > 0;
    const dialogWidth = contactCount > 1 ? 'min(900px, 95vw)' : 'min(520px, 95vw)';
    const dialogRef = this.dialog.open(ContactlistComponent, {
      panelClass: hasContacts ? 'ContactListDialog' : undefined,
      closeOnNavigation: true,
      data: {},
      minWidth: 'min(360px, 95vw)',
      maxWidth: '95vw',
      width: dialogWidth,
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("contactList");
      window.history.replaceState(this.myHistory, '', '');
    });

  }

  public openMarkerMultiDialog(messages: Message[], notes: Note[], images: LocalImage[], documents: LocalDocument[]) {
    const dialogRef = this.dialog.open(MultiMarkerComponent, {
      data: { messages: messages, notes: notes, images: images, documents: documents },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("multiMarker");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        switch (result.type) {
          case 'public_message':
            this.messageService.setMessages(result.messages)
            this.openMarkerMessageListDialog(result.messages);
            break
          case 'private_note':
            this.openMarkerNoteListDialog(result.notes);
            break
          case 'private_image':
            this.openMarkerImageListDialog(result.images);
            break
          case 'private_document':
            this.openMarkerDocumentListDialog(result.documents);
            break
        }
      }
    });
  }

  public openMarkerMessageListDialog(messages: Message[]) {
    const dialogRef = this.dialog.open(MessagelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { location: messages[0].location },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("messageList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(() => {
      this.messageService.clearSelectedMessages();
      this.updateDataForLocation();
    });
  }

  public openMarkerNoteListDialog(notes: Note[]) {
    const notesSignal = signal<Note[]>(notes);
    const dialogRef = this.dialog.open(NotelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { location: notesSignal()[0].location, notesSignal: notesSignal },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("noteList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(() => {
      this.updateDataForLocation();
    });
  }

  public openMarkerImageListDialog(images: LocalImage[]) {
    const imagesSignal = signal<LocalImage[]>(images);
    const dialogRef = this.dialog.open(ImagelistComponent, {
      panelClass: 'ImageListDialog',
      closeOnNavigation: true,
      data: {
        location: imagesSignal()[0].location,
        imagesSignal: imagesSignal,
        skipExifOverride: false
      },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("imageList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(() => {
      this.updateDataForLocation();
    });
  }

  public openMarkerDocumentListDialog(documents: LocalDocument[]) {
    const documentsSignal = signal<LocalDocument[]>(documents);
    const dialogRef = this.dialog.open(DocumentlistComponent, {
      panelClass: 'DocumentListDialog',
      closeOnNavigation: true,
      data: {
        location: documentsSignal()[0].location,
        documentsSignal: documentsSignal
      },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("documentList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(() => {
      this.updateDataForLocation();
    });
  }

  public showLegalNotice() {
    this.dialog.open(LegalNoticeComponent, {
      data: {},
      closeOnNavigation: true,
      autoFocus: false,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true
    });
  }

  public showDisclaimer() {
    this.dialog.open(DisclaimerComponent, {
      data: {},
      closeOnNavigation: true,
      autoFocus: false,
      disableClose: false,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true
    });
  }

  public showPrivacyPolicy() {
    this.dialog.open(PrivacyPolicyComponent, {
      data: {},
      closeOnNavigation: true,
      autoFocus: false,
      disableClose: false,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true
    });
  }

  public showTermsOfService() {
    this.dialog.open(TermsOfServiceComponent, {
      data: {},
      closeOnNavigation: true,
      autoFocus: false,
      disableClose: false,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true
    });
  }

  public showLicenses() {
    this.dialog.open(ThirdPartyLicensesComponent, {
      data: {},
      closeOnNavigation: true,
      autoFocus: false,
      disableClose: false,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
    });
  }

  public editAppSettings() {
    this.dialog.open(AppSettingsComponent, {
      data: { appSettings: this.appService.getAppSettings() },
      closeOnNavigation: true,
      maxHeight: '90vh',
      width: 'auto',
      maxWidth: '90vw',
      autoFocus: false,
      hasBackdrop: true
    });

  }

  public editExternalContentSettings() {
    this.dialog.open(ExternalContentComponent, {
      data: { appSettings: this.appService.getAppSettings() },
      closeOnNavigation: true,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      autoFocus: false,
      hasBackdrop: true
    });
  }

  public startRestore() {
    this.restoreService.startRestore();
  }

  public editUserProfile() {
    const dialogRef = this.dialog.open(UserProfileComponent, {
      data: {},
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.userService.saveProfile();
    });
  }

  public deleteUser() {
    const dialogRef = this.dialog.open(DeleteUserComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.deleteUser(this.userService.getUser().id)
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) {
                this.userService.logout();
                this.indexedDbService.clearAllData();
                this.updateDataForLocation();
                this.snackBarRef = this.snackBar.open(this.translation.t('common.user.deleteSuccess'), undefined, {
                  panelClass: ['snack-success'],
                  horizontalPosition: 'center',
                  verticalPosition: 'top',
                  duration: 3000
                });
              }
            },
            error: () => {
              this.snackBarRef = this.snackBar.open(this.translation.t('errors.unknown'), undefined, {
                panelClass: ['snack-warning'],
                horizontalPosition: 'center',
                verticalPosition: 'top',
                duration: 2000
              });
            }
          });
      }
    });
  }

  public showUser() {
    const dialogRef = this.dialog.open(UserComponent, {
      data: {},
      closeOnNavigation: true,
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(result => {
      switch (result?.action) {
        case "deleteUserId":
          this.deleteUser();
          break
        case "backup":
          this.backupService.startBackup();
          break;
        case "changePin":
          this.userService.changePin();
          break;
        case "resetKeys":
          this.userService.resetKeys();
          break;
      }
    });
  }

  public showWeather() {
    this.weatherService
      .getWeather(
        this.userService.getUser().language?.slice(0, 2) || 'de',
        this.mapService.getMapLocation().plusCode,
        this.mapService.getMapLocation().latitude,
        this.mapService.getMapLocation().longitude,
        3
      )
      .subscribe({
        next: (weather) => {
          this.dialog.open(WeatherComponent, {
            data: { weather: weather, location: this.mapService.getMapLocation() },
            closeOnNavigation: true,
            minWidth: '90vw',
            width: '90vw',
            maxWidth: '90vw',
            minHeight: '90vh',
            height: '90vh',
            maxHeight: '90vh',
            hasBackdrop: true,
            autoFocus: false
          });
        },
        error: (err) => {
          this.dialog.open(DisplayMessage, {
            panelClass: '',
            closeOnNavigation: false,
            data: {
              showAlways: true,
              title: this.networkService.getErrorTitle(err.status),
              icon: this.networkService.getErrorIcon(err.status),
              message: this.networkService.getErrorMessage(err.status),
              showSpinner: false
            },
            maxWidth: '90vw',
            maxHeight: '90vh',
            hasBackdrop: true
          });
        }
      });

  }

  public showAirQuality() {
    this.airQualityService
      .getAirQuality(
        this.mapService.getMapLocation().plusCode,
        this.mapService.getMapLocation().latitude,
        this.mapService.getMapLocation().longitude,
        3
      )
      .subscribe({
        next: (airQualityData) => {
          this.dialog.open(AirQualityComponent, {
            data: { airQuality: airQualityData, location: this.mapService.getMapLocation() },
            closeOnNavigation: true,
            minWidth: '90vw',
            width: '90vw',
            maxWidth: '90vw',
            height: '90vh',
            maxHeight: '90vh',
            hasBackdrop: true,
            autoFocus: false
          });
        },
        error: (err) => {
          this.dialog.open(DisplayMessage, {
            data: {
              showAlways: true,
              title: this.networkService.getErrorTitle(err.status),
              icon: this.networkService.getErrorIcon(err.status),
              message: this.networkService.getErrorMessage(err.status),
              showSpinner: false
            },
            maxWidth: '90vw',
            maxHeight: '90vh',
            hasBackdrop: true,
            autoFocus: false
          });
        }
      });
  }

  public showGeoStatistic() {
    this.geoStatisticService
      .getDataForLocation(
        this.mapService.getMapLocation().plusCode,
        this.mapService.getMapLocation().latitude,
        this.mapService.getMapLocation().longitude,
        10
      )
      .subscribe({
        next: (response: GetGeoStatisticResponse) => {
          if (response.status === 200) {
            this.dialog.open(GeoStatisticComponent, {
              data: { geoStatistic: response.result },
              closeOnNavigation: true,
              minWidth: '90vw',
              maxWidth: '90vw',
              minHeight: '20vh',
              height: '90vh',
              maxHeight: '90vh',
              hasBackdrop: true
            });
          } else {
            // Bei Fehlerstatus trotzdem Fehlerdialog zeigen
            this.showGeoStatisticError(this.translation.t('common.geoStatistic.unexpectedResponse'));
          }
        },
        error: (err) => {
          this.showGeoStatisticError(err.error.error);
        }
      });
  }

  private showGeoStatisticError(message: string) {
    this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.geoStatistic.title'),
        image: '',
        icon: 'bug_report',
        message: message,
        button: '',
        delay: 0,
        showSpinner: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });
  }

  async showNominatimSearchDialog() {
    const searchValues = await this.indexedDbService.getSetting<{
      searchterm: string;
      selectedRadius: number;
      nominatimPlaces: NominatimPlace[];
    }>('nominatimSearch');
    const dialogRef = this.dialog.open(NominatimSearchComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { location: this.mapService.getMapLocation(), searchValues: searchValues ?? undefined },
      minWidth: 'min(450px, 95vw)',
      width: '90vw',
      maxWidth: '90vw',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result: {
      action: string,
      selectedPlace: NominatimPlace;
      searchValues: {
        searchterm: string,
        selectedRadius: number,
        nominatimPlaces: NominatimPlace[]
      }
    }) => {
      if (result) {
        this.indexedDbService.setSetting('nominatimSearch', result.searchValues);
        switch (result.action) {
          case 'saveSearch':
            this.indexedDbService.setSetting('nominatimSelectedPlace', result.selectedPlace);
            break;
        }
      } else {
        this.indexedDbService.deleteSetting('nominatimSelectedPlace')
        this.indexedDbService.deleteSetting('nominatimSearch')
      }
    });
  }

  private createMarkerLocations() {
    this.markerLocations.clear();
    let center: Location | undefined = undefined;
    // Process messages
    const messages = this.messageService.messagesSignal();
    messages.forEach((message) => {
      if (this.mapService.getMapZoom() > 17) {
        center = message.location
      } else {
        const plusCode: string = this.geolocationService.getGroupedPlusCodeBasedOnMapZoom(message.location, this.mapService.getMapZoom());
        const plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
        center = {
          latitude: plusCodeArea.latitudeCenter,
          longitude: plusCodeArea.longitudeCenter,
          plusCode: plusCode
        };
      }
      if (!this.markerLocations.has(center.plusCode)) {
        this.markerLocations.set(center.plusCode, {
          location: center,
          messages: [message],
          notes: [],
          images: [],
          documents: [],
          type: MarkerType.PUBLIC_MESSAGE
        });
      } else {
        this.markerLocations.get(center.plusCode)!.messages.push(message)
        if (this.markerLocations.get(center.plusCode)?.type != MarkerType.PUBLIC_MESSAGE) {
          this.markerLocations.get(center.plusCode)!.type = MarkerType.MULTI;
        }
      }
    });
    // Process notes
    const notes = this.noteService.getNotesSignal()();
    notes.forEach((note) => {
      const noteLocation: Location = {
        latitude: note.location.latitude,
        longitude: note.location.longitude,
        plusCode: note.location.plusCode
      };
      if (this.mapService.getMapZoom() > 17) {
        center = noteLocation;
      } else {
        const plusCode: string = this.geolocationService.getGroupedPlusCodeBasedOnMapZoom(noteLocation, this.mapService.getMapZoom());
        const plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
        center = {
          latitude: plusCodeArea.latitudeCenter,
          longitude: plusCodeArea.longitudeCenter,
          plusCode: plusCode
        };
      }
      if (this.markerLocations.has(center.plusCode)) {
        this.markerLocations.get(center.plusCode)!.notes.push(note)
        if (this.markerLocations.get(center.plusCode)?.type != MarkerType.PRIVATE_NOTE) {
          this.markerLocations.get(center.plusCode)!.type = MarkerType.MULTI;
        }
      } else {
        this.markerLocations.set(center.plusCode, {
          location: center,
          messages: [],
          notes: [note],
          images: [],
          documents: [],
          type: MarkerType.PRIVATE_NOTE
        });
      }
    });

    // Process images
    const images = this.localImageService.getImagesSignal()();
    images.forEach((image) => {
      const imageLocation: Location = {
        latitude: image.location.latitude,
        longitude: image.location.longitude,
        plusCode: image.location.plusCode
      };
      if (this.mapService.getMapZoom() > 17) {
        center = imageLocation;
      } else {
        const plusCode: string = this.geolocationService.getGroupedPlusCodeBasedOnMapZoom(imageLocation, this.mapService.getMapZoom());
        const plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
        center = {
          latitude: plusCodeArea.latitudeCenter,
          longitude: plusCodeArea.longitudeCenter,
          plusCode: plusCode
        };
      }
      if (this.markerLocations.has(center.plusCode)) {
        this.markerLocations.get(center.plusCode)!.images.push(image)
        if (this.markerLocations.get(center.plusCode)?.type != MarkerType.PRIVATE_IMAGE) {
          this.markerLocations.get(center.plusCode)!.type = MarkerType.MULTI;
        }
      } else {
        this.markerLocations.set(center.plusCode, {
          location: center,
          messages: [],
          notes: [],
          images: [image],
          documents: [],
          type: MarkerType.PRIVATE_IMAGE
        });
      }
    });

    // Process documents
    const documents = this.localDocumentService.getDocumentsSignal()();
    documents.forEach((document) => {
      const documentLocation: Location = {
        latitude: document.location.latitude,
        longitude: document.location.longitude,
        plusCode: document.location.plusCode
      };
      if (this.mapService.getMapZoom() > 17) {
        center = documentLocation;
      } else {
        const plusCode: string = this.geolocationService.getGroupedPlusCodeBasedOnMapZoom(documentLocation, this.mapService.getMapZoom());
        const plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
        center = {
          latitude: plusCodeArea.latitudeCenter,
          longitude: plusCodeArea.longitudeCenter,
          plusCode: plusCode
        };
      }
      if (this.markerLocations.has(center.plusCode)) {
        this.markerLocations.get(center.plusCode)!.documents.push(document)
        if (this.markerLocations.get(center.plusCode)?.type != MarkerType.PRIVATE_DOCUMENT) {
          this.markerLocations.get(center.plusCode)!.type = MarkerType.MULTI;
        }
      } else {
        this.markerLocations.set(center.plusCode, {
          location: center,
          messages: [],
          notes: [],
          images: [],
          documents: [document],
          type: MarkerType.PRIVATE_DOCUMENT
        });
      }
    });

    // Save last markerupdet to fire the angular change listener
    this.lastMarkerUpdate = new Date().getMilliseconds();
  }

  private resetBadgeAnimation(): void {
    this.badgeAnimationRunning = false;
    if (this.badgeAnimationTimer) {
      clearTimeout(this.badgeAnimationTimer);
    }
    this.badgeAnimationTimer = undefined;
  }

  private triggerBadgeAnimation(): void {
    if (this.badgeAnimationRunning) {
      return;
    }
    this.badgeAnimationRunning = true;
    this.animateUserBadgeTick.update((n) => n + 1);
    this.badgeAnimationTimer = setTimeout(() => {
      this.badgeAnimationRunning = false;
      this.badgeAnimationTimer = undefined;
    }, 1100);
  }
}
