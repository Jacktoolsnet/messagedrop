import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { CommonModule, PlatformLocation } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Meta, Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { AirQualityComponent } from './components/air-quality/air-quality.component';
import { AppSettingsComponent } from './components/app-settings/app-settings.component';
import { ContactlistComponent } from './components/contactlist/contactlist.component';
import { EditMessageComponent } from './components/editmessage/edit-message.component';
import { EditNoteComponent } from './components/editnote/edit-note.component';
import { GeoStatisticComponent } from './components/geo-statistic/geo-statistic.component';
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
import { Location } from './interfaces/location';
import { MarkerLocation } from './interfaces/marker-location';
import { MarkerType } from './interfaces/marker-type';
import { Message } from './interfaces/message';
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
import { ContactMessageService } from './services/contact-message.service';
import { ContactService } from './services/contact.service';
import { GeoStatisticService } from './services/geo-statistic.service';
import { GeolocationService } from './services/geolocation.service';
import { IndexedDbService } from './services/indexed-db.service';
import { LocalImageFileService } from './services/local-image-file.service';
import { MapService } from './services/map.service';
import { MessageService } from './services/message.service';
import { NetworkService } from './services/network.service';
import { NoteService } from './services/note.service';
import { OembedService } from './services/oembed.service';
import { PlaceService } from './services/place.service';
import { ServerService } from './services/server.service';
import { SharedContentService } from './services/shared-content.service';
import { SocketioService } from './services/socketio.service';
import { SystemNotificationService } from './services/system-notification.service';
import { UserService } from './services/user.service';
import { WeatherService } from './services/weather.service';

@Component({
  selector: 'app-root',
  imports: [
    ConsentGateComponent,
    MatBadgeModule,
    CommonModule,
    RouterOutlet,
    MapComponent,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    ShortNumberPipe,
    MatMenuModule
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
  private readonly localImageFileService = inject(LocalImageFileService);
  private readonly messageService = inject(MessageService);
  private readonly socketioService = inject(SocketioService);
  private readonly airQualityService = inject(AirQualityService);
  private readonly weatherService = inject(WeatherService);
  private readonly geoStatisticService = inject(GeoStatisticService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly platformLocation = inject(PlatformLocation);
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
  readonly animateUserBadgeTick = signal<number>(0);
  private lastUnreadTotal = 0;
  private badgeAnimationTimer?: ReturnType<typeof setTimeout>;
  private badgeAnimationRunning = false;
  private lastLiveMessageId?: string;

  constructor() {
    effect(async () => {
      this.appService.settingsSet(); // <-- track changes
      this.appService.chekConsentCompleted();
      if (this.appService.isConsentCompleted()) {
        // Clear cache
        this.indexedDbService.deleteSetting('nominatimSelectedPlace')
        this.indexedDbService.deleteSetting('nominatimSearch')
        // Check network
        this.networkService.init();
        // Init the server connection
        this.serverService.init();
        // Get user id if avaliable
        this.userService.initUserId();
      } else {
        this.logout();
      }
    });

    effect(() => {
      this.serverService.serverSet(); // <-- track changes
      if (this.serverService.isReady() && this.appService.isConsentCompleted()) {
        // Init the map
        this.mapService.initMap();
      }
      if (this.serverService.isFailed()) {
        const dialogRef = this.dialog.open(DisplayMessage, {
          panelClass: '',
          closeOnNavigation: false,
          data: {
            showAlways: true,
            title: 'Oops! Our server went on a coffee break...',
            image: '',
            icon: 'cloud_off',
            message: 'Apparently, our backend needed some “me time”.\n\nDon’t worry, we sent a carrier pigeon to bring it back.',
            button: 'Retry...',
            delay: 10000,
            showSpinner: false
          },
          maxWidth: '90vw',
          maxHeight: '90vh',
          hasBackdrop: false,
          autoFocus: false
        });

        dialogRef.afterClosed().subscribe(() => {
          // Notification Action
          this.handleNotification();
        });
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
        this.contactService.initContacts();
        if (!this.placeService.isReady()) {
          this.placeService.initPlaces();
        }
        if (this.userService.isReady()) {
          this.contactMessageService.initLiveReceive();
          void this.systemNotificationService.refreshUnreadCount();
        } else {
          this.systemNotificationService.reset();
        }
      } else {
        this.systemNotificationService.reset();
      }
    });

    effect(() => {
      this.contactService.contactsSet(); // track changes for unread badge
      if (this.appService.isConsentCompleted() && this.userService.isReady()) {
        this.refreshContactUnreadCounts();
      } else {
        this.unreadContactCounts.set({});
        this.resetBadgeAnimation();
      }
    });

    effect(() => {
      this.contactService.contactsSet(); // <-- track changes
      if (this.appService.isConsentCompleted()) {
        this.socketioService.initSocket();
      }
    });

    effect(() => {
      const update = this.contactMessageService.unreadCountUpdate();
      if (update) {
        this.unreadContactCounts.update((map) => ({ ...map, [update.contactId]: update.unread }));
      }
    }, { allowSignalWrites: true });

    effect(() => {
      if (!this.userService.isReady() || !this.appService.isConsentCompleted()) {
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
    }, { allowSignalWrites: true });

    effect(() => {
      const incoming = this.contactMessageService.liveMessages();
      if (!incoming || !this.userService.isReady() || !this.appService.isConsentCompleted()) {
        return;
      }
      if (incoming.id !== this.lastLiveMessageId && incoming.direction === 'contactUser') {
        this.lastLiveMessageId = incoming.id;
        this.triggerBadgeAnimation();
      }
    }, { allowSignalWrites: true });

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
    // Titel
    this.titleService.setTitle('MessageDrop – Explore Places & News');
    // Meta-Tags
    this.metaService.updateTag({ name: 'description', content: 'Discover real places, social media, weather and news in one app.' });
    this.metaService.updateTag({ name: 'keywords', content: 'MessageDrop, Places, News, Weather, Social' });
    this.metaService.updateTag({ name: 'robots', content: 'index, follow' });

    // Optional: Open Graph / Twitter für Social Sharing
    this.metaService.updateTag({ property: 'og:title', content: 'MessageDrop' });
    this.metaService.updateTag({ property: 'og:description', content: 'Your gateway to social stories, places, and updates.' });
    this.metaService.updateTag({ property: 'og:image', content: 'https://messagedrop.de/assets/icons/icon-512x512.png' });

    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: 'MessageDrop' });
    this.metaService.updateTag({ name: 'twitter:description', content: 'Discover your world – smarter.' });
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
        this.snackBar.open(JSON.stringify(content, null, 2), 'OK', {
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    }

    const dialogRef = this.dialog.open(SharedContentComponent, {
      data: { multimedia, location },
      closeOnNavigation: true,
      minWidth: '20vw',
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
      this.snackBar.open(`Notification content received -> ${notificationAction}`, 'OK');
      // z. B. Navigation starten, Dialog öffnen, etc.
      void this.systemNotificationService.refreshUnreadCount();
    }
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
        title: 'Locating You',
        image: '',
        icon: 'place',
        message: 'Please wait while your device determine your current location...',
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
          this.mapService.setUserMarker(this.userService.getUser().location);
          this.mapService.moveToWithZoom(this.userService.getUser().location, 17);
          this.updateDataForLocation();
        },
        error: (error) => {
          dialogRef.close();
          this.locationReady = false;
          if (error.code == 1) {
            this.snackBarRef = this.snackBar.open(`Please authorize location.`, 'OK', {
              panelClass: ['snack-info'],
              horizontalPosition: 'center',
              verticalPosition: 'top',
              duration: 1000
            });
          } else {
            this.snackBarRef = this.snackBar.open("Position could not be determined. Please try again later.", 'OK', {
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
    }
    // Messages
    this.messageService.getByVisibleMapBoundingBox();
  }

  public handleMoveEndEvent() {
    this.updateDataForLocation();
    this.setIsUserLocation();
    // this.mapService.drawSearchRectange(event);
    this.mapService.setCircleMarker();
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
      case MarkerType.MULTI:
        this.openMarkerMultiDialog(event.messages, event.notes);
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
      createDateTime: '',
      deleteDateTime: '',
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
      minWidth: '20vw',
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
      minWidth: '20vw',
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
    if (!this.localImageFileService.isSupported()) {
      this.snackBar.open('File picker is not supported in this browser.', undefined, { duration: 4000 });
      return;
    }

    const location = this.mapService.getMapLocation();
    const plusCode = this.geolocationService.getPlusCode(location.latitude, location.longitude) || location.plusCode;

    try {
      const entry = await this.localImageFileService.createImageEntryForOwner(
        this.userService.getUser().id,
        {
          fallbackLocation: {
            lat: location.latitude,
            lon: location.longitude,
            source: 'entity',
            plusCode
          },
          fallbackPlusCode: plusCode ?? undefined
        }
      );

      if (!entry) {
        return;
      }

      await this.indexedDbService.saveImage(entry);
      this.snackBar.open('Image saved locally.', undefined, { duration: 3000 });
    } catch (error) {
      console.error('Failed to add image', error);
      this.snackBar.open('Unable to save the image.', undefined, { duration: 4000 });
    }

  }


  public openSystemMessages(): void {
    if (!this.userService.isReady()) {
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
    this.userService.getUserMessages(this.userService.getUser())
      .subscribe({
        next: (getMessageResponse) => {
          const allMessages: Message[] = this.messageService.mapRawMessages(getMessageResponse.rows);
          this.messageService.setMessages(allMessages.filter(msg => !msg.parentUuid))
          const dialogRef = this.dialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { location: this.mapService.getMapLocation() },
            minWidth: '20vw',
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
            this.messageService.getByVisibleMapBoundingBox();
          });
        },
        error: () => {
          this.messageService.clearMessages();
          const dialogRef = this.dialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { location: this.mapService.getMapLocation() },
            minWidth: '20vw',
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

  public openUserNoteListDialog(): void {
    this.noteService.loadNotes().then(() => {
      const dialogRef = this.dialog.open(NotelistComponent, {
        panelClass: 'NoteListDialog',
        closeOnNavigation: true,
        data: { location: this.mapService.getMapLocation(), notesSignal: this.noteService.getNotesSignal() },
        minWidth: '20vw',
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
    const dialogRef = this.dialog.open(PlacelistComponent, {
      panelClass: 'PalceListDialog',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("placeList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((places: Place[]) => {
      if (places) {
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
    const dialogRef = this.dialog.open(ContactlistComponent, {
      panelClass: 'ContactListDialog',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: '95vh',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.myHistory.push("contactList");
      window.history.replaceState(this.myHistory, '', '');
    });

  }

  public openMarkerMultiDialog(messages: Message[], notes: Note[]) {
    const dialogRef = this.dialog.open(MultiMarkerComponent, {
      data: { messages: messages, notes: notes },
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
        }
      }
    });
  }

  public openMarkerMessageListDialog(messages: Message[]) {
    const dialogRef = this.dialog.open(MessagelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { location: messages[0].location },
      minWidth: '20vw',
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
      minWidth: '20vw',
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
      width: '800px',
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

  public editUserProfile() {
    const dialogRef = this.dialog.open(UserProfileComponent, {
      data: {},
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true
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
                this.snackBarRef = this.snackBar.open("User and related data were removed permanently.", undefined, {
                  panelClass: ['snack-success'],
                  horizontalPosition: 'center',
                  verticalPosition: 'top',
                  duration: 3000
                });
              }
            },
            error: () => {
              this.snackBarRef = this.snackBar.open("Oops, something went wrong. Please try again later.", undefined, {
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
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(result => {
      switch (result?.action) {
        case "deleteUserId":
          this.deleteUser();
          break
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
            data: { airQuality: airQualityData },
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
            this.showGeoStatisticError('Unexpected response');
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
        title: 'GeoStatistic Service',
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
      minWidth: '20vw',
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
          type: MarkerType.PRIVATE_NOTE
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
