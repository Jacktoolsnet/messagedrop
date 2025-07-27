import { CommonModule, PlatformLocation } from '@angular/common';
import { Component, computed, effect, OnInit, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Meta, Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { AirQualityComponent } from './components/air-quality/air-quality.component';
import { AppSettingsComponent } from './components/app-settings/app-settings.component';
import { ContactlistComponent } from './components/contactlist/contactlist.component';
import { EditMessageComponent } from './components/editmessage/edit-message.component';
import { EditNoteComponent } from './components/editnote/edit-note.component';
import { GeoStatisticComponent } from './components/geo-statistic/geo-statistic.component';
import { MapComponent } from './components/map/map.component';
import { MultiMarkerComponent } from './components/map/multi-marker/multi-marker.component';
import { MessagelistComponent } from './components/messagelist/messagelist.component';
import { NotelistComponent } from './components/notelist/notelist.component';
import { PlacelistComponent } from './components/placelist/placelist.component';
import { SharedContentComponent } from './components/shared-content/shared-content.component';
import { DeleteUserComponent } from './components/user/delete-user/delete-user.component';
import { UserProfileComponent } from './components/user/user-profile/user-profile.component';
import { UserComponent } from './components/user/user.component';
import { DisplayMessage } from './components/utils/display-message/display-message.component';
import { NominatimSearchComponent } from './components/utils/nominatim-search/nominatim-search.component';
import { WeatherComponent } from './components/weather/weather.component';
import { AppSettings } from './interfaces/app-settings';
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
import { Profile } from './interfaces/profile';
import { SharedContent } from './interfaces/shared-content';
import { ShortNumberPipe } from './pipes/short-number.pipe';
import { AirQualityService } from './services/air-quality.service';
import { AppService } from './services/app.service';
import { ContactService } from './services/contact.service';
import { CryptoService } from './services/crypto.service';
import { GeoStatisticService } from './services/geo-statistic.service';
import { GeolocationService } from './services/geolocation.service';
import { IndexedDbService } from './services/indexed-db.service';
import { MapService } from './services/map.service';
import { MessageService } from './services/message.service';
import { NetworkService } from './services/network.service';
import { NoteService } from './services/note.service';
import { OembedService } from './services/oembed.service';
import { PlaceService } from './services/place.service';
import { ServerService } from './services/server.service';
import { SharedContentService } from './services/shared-content.service';
import { SocketioService } from './services/socketio.service';
import { StatisticService } from './services/statistic.service';
import { UserService } from './services/user.service';
import { WeatherService } from './services/weather.service';

@Component({
  selector: 'app-root',
  imports: [
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
  styleUrl: './app.component.css'
})

export class AppComponent implements OnInit {
  public locationReady: boolean = false;
  public myHistory: string[] = [];
  public markerLocations: Map<string, MarkerLocation> = new Map<string, MarkerLocation>();
  private snackBarRef: any;
  public isUserLocation: boolean = false;
  public initWatchingPosition: boolean = false;
  public mode: typeof Mode = Mode;
  public lastMarkerUpdate: number = 0;
  public locationSubscriptionError: boolean = false;
  public isPartOfPlace: boolean = false;
  private showComponent: boolean = false;
  readonly userMessagesSignal = computed(() =>
    this.messageService.messagesSignal().filter(
      msg => msg.userId === this.userService.getUser().id
    )
  );

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private appService: AppService,
    public networkService: NetworkService,
    private sharedContentService: SharedContentService,
    private indexedDbService: IndexedDbService,
    public serverService: ServerService,
    public userService: UserService,
    public mapService: MapService,
    public noteService: NoteService,
    private oembedService: OembedService,
    public placeService: PlaceService,
    public contactService: ContactService,
    private geolocationService: GeolocationService,
    private cryptoService: CryptoService,
    private messageService: MessageService,
    private statisticService: StatisticService,
    private socketioService: SocketioService,
    private airQualityService: AirQualityService,
    private weatherService: WeatherService,
    private geoStatisticService: GeoStatisticService,
    private snackBar: MatSnackBar,
    public checkPinDialog: MatDialog,
    public messageDialog: MatDialog,
    public noteDialog: MatDialog,
    public messageListDialog: MatDialog,
    public placeListDialog: MatDialog,
    public contactListDialog: MatDialog,
    public userProfileDialog: MatDialog,
    public appSettingsDialog: MatDialog,
    public displayMessage: MatDialog,
    public sharedContentDialog: MatDialog,
    public nominatimSearchDialog: MatDialog,
    public dialog: MatDialog,
    private platformLocation: PlatformLocation
  ) {
    effect(() => {
      if (this.serverService.serverSet()) {
        if (this.serverService.isReady()) {
          // Init the map
          this.mapService.initMap();
        }
        if (this.serverService.isFailed()) {
          const dialogRef = this.displayMessage.open(DisplayMessage, {
            panelClass: '',
            closeOnNavigation: false,
            data: {
              showAlways: true,
              title: 'Oops! Our server went on a coffee break...',
              image: '',
              icon: 'cloud_off',
              message: `Apparently, our backend needed some “me time”.
              
              Don’t worry, we sent a carrier pigeon to bring it back.`,
              button: 'Retry...',
              delay: 10000,
              showSpinner: false
            },
            maxWidth: '90vw',
            maxHeight: '90vh',
            hasBackdrop: false,
            autoFocus: false
          });

          dialogRef.afterOpened().subscribe(e => { });

          dialogRef.afterClosed().subscribe(() => {
            this.initApp();
          });
        }
      }
    });

    effect(() => {
      if (this.mapService.mapSet()) {
        // Fly to position if user alrady allowed location.
        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          if (result.state === 'granted') {
            this.getCurrentPosition();
          } else {
            this.updateDataForLocation(this.mapService.getMapLocation(), true);
          }
        });
      }
    });

    effect(() => {
      if (this.userService.userSet()) {
        this.contactService.initContacts();
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      }
    });

    effect(() => {
      if (this.contactService.contactsSet()) {
        this.socketioService.initSocket();
        this.placeService.initPlaces();
      }
    });

    effect(() => {
      if (this.messageService.messageSet()) {
        this.createMarkerLocations();
      }
    });

    this.initApp();
  }


  async initApp() {
    this.appService.loadAppSettings();
    // Shared Content
    effect(() => {
      const content = this.sharedContentService.getSharedContentSignal()();
      if (content) {
        this.handleSharedContent(content);
      }
    });
    // Notification Action
    this.handleNotification();
    // Clear cache
    this.indexedDbService.deleteSetting('nominatimSelectedPlace')
    this.indexedDbService.deleteSetting('nominatimSearch')
    // Check network
    this.networkService.init();
    // Init the server connection
    this.serverService.init();
    // Count
    this.statisticService.countVisitor()
      .subscribe({
        next: (data) => { },
        error: (err) => { },
        complete: () => { }
      });
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
    this.platformLocation.onPopState((event) => {
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
    this.updateDataForLocation(this.mapService.getMapLocation(), true);
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

    const dialogRef = this.sharedContentDialog.open(SharedContentComponent, {
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
      // z. B. Navigation starten, Dialog öffnen, etc.
    }
  }

  private setIsUserLocation(): void {
    if (this.userService.getUser().location.plusCode === this.mapService.getMapLocation().plusCode) {
      this.isUserLocation = true;
    } else {
      this.isUserLocation = false;
    }
  }

  public getCurrentPosition() {
    const dialogRef = this.displayMessage.open(DisplayMessage, {
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
          this.updateDataForLocation(this.mapService.getMapLocation(), true);
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
          this.snackBarRef.afterDismissed().subscribe(() => { });
        }
      });
    });

    dialogRef.afterClosed().subscribe(() => {
      // Optional: Aktionen nach Schließen
    });
  }

  private async updateDataForLocation(location: Location, forceSearch: boolean) {
    if (this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom()) !== this.messageService.getLastSearchedLocation() || forceSearch) {
      // Clear markerLocations
      this.markerLocations.clear()
      // notes from local device
      if (this.userService.isReady()) {
        await this.noteService.filterByPlusCode(this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom()));
      }
      // Messages
      this.messageService.getByPlusCode(location);
      this.createMarkerLocations();
    }
  }

  public handleMoveEndEvent(event: Location) {
    this.updateDataForLocation(event, false)
    this.setIsUserLocation()
    this.mapService.drawSearchRectange(event);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.setCircleMarker(event);
    this.mapService.setDrawCircleMarker(false);
  }

  public handleMarkerClickEvent(event: MarkerLocation) {
    let location: Location = {
      latitude: event.location.latitude,
      longitude: event.location.longitude,
      plusCode: event.location.plusCode
    }
    //this.mapService.moveTo(location);
    switch (event.type) {
      case MarkerType.PUBLIC_MESSAGE:
        this.messageService.setMessages(event.messages)
        this.openMarkerMessageListDialog(event.messages);
        break;
      case MarkerType.PRIVATE_NOTE:
        if (this.userService.isReady()) {
          this.noteService.filterByPlusCode(this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom())).then(notes => {
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
    let message: Message = {
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

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, message: message },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.message) {
        this.messageService.createMessage(data.message, this.userService.getUser());
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      }
    });
  }

  async openNoteDialog(): Promise<void> {
    let note: Note = {
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
    const dialogRef = this.noteDialog.open(EditNoteComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_NOTE, user: this.userService.getUser(), note: note },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '30vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("noteDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.note) {
        data.note.latitude = this.mapService.getMapLocation().latitude;
        data.note.longitude = this.mapService.getMapLocation().longitude;
        data.note.plusCode = this.mapService.getMapLocation().plusCode;
        this.noteService.addNote(data.note);
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      }
    });
  }

  public openUserMessagListDialog(): void {
    this.userService.getUserMessages(this.userService.getUser())
      .subscribe({
        next: (getMessageResponse) => {
          const allMessages: Message[] = this.messageService.mapRawMessages(getMessageResponse.rows);
          this.messageService.setMessages(allMessages.filter(msg => !msg.parentUuid))
          const dialogRef = this.messageListDialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { messages: this.userMessagesSignal(), location: this.mapService.getMapLocation() },
            minWidth: '20vw',
            maxWidth: '90vw',
            minHeight: '8rem',
            maxHeight: '90vh',
            hasBackdrop: true,
            autoFocus: false
          });

          dialogRef.afterOpened().subscribe(e => {
            this.myHistory.push("userMessageList");
            window.history.replaceState(this.myHistory, '', '');
          });

          dialogRef.afterClosed().subscribe((data: any) => {
            this.messageService.clearSelectedMessages();
            this.messageService.getByPlusCode(this.mapService.getMapLocation());
          });
        },
        error: (err) => {
          this.messageService.clearMessages();
          const dialogRef = this.messageListDialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { messages: this.userMessagesSignal(), location: this.mapService.getMapLocation() },
            minWidth: '20vw',
            maxWidth: '90vw',
            minHeight: '8rem',
            maxHeight: '90vh',
            hasBackdrop: true,
            autoFocus: false
          });

          dialogRef.afterOpened().subscribe(e => {
            this.myHistory.push("userMessageList");
            window.history.replaceState(this.myHistory, '', '');
          });

          dialogRef.afterClosed().subscribe((data: any) => {
            this.messageService.clearSelectedMessages();
            this.messageService.getByPlusCode(this.mapService.getMapLocation());
            this.updateDataForLocation(this.mapService.getMapLocation(), true);
          });
        },
        complete: () => { }
      });
  }

  public openUserNoteListDialog(): void {
    this.noteService.loadNotes().then(notes => {
      const dialogRef = this.messageListDialog.open(NotelistComponent, {
        panelClass: 'NoteListDialog',
        closeOnNavigation: true,
        data: { location: this.mapService.getMapLocation(), notesSignal: this.noteService.getNotesSignal() },
        minWidth: '20vw',
        maxWidth: '90vw',
        minHeight: '8rem',
        maxHeight: '90vh',
        hasBackdrop: true,
        autoFocus: false
      });

      dialogRef.afterOpened().subscribe(e => {
        this.myHistory.push("userNoteList");
        window.history.replaceState(this.myHistory, '', '');
      });

      dialogRef.afterClosed().subscribe((data: any) => {
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      });
    });
  }

  public openPlaceListDialog(): void {
    const dialogRef = this.placeListDialog.open(PlacelistComponent, {
      panelClass: 'PalceListDialog',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: 'none',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
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
            },
            error: (err) => { },
            complete: () => { }
          });
        });
      }
      this.updateDataForLocation(this.mapService.getMapLocation(), true);
    });
  }

  public openContactListDialog(): void {
    const dialogRef = this.contactListDialog.open(ContactlistComponent, {
      panelClass: 'ContactListDialog',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: 'none',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("contactList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: Place) => {
      if (undefined != data) {

      }
    });
  }

  public openMarkerMultiDialog(messages: Message[], notes: Note[]) {
    const dialogRef = this.dialog.open(MultiMarkerComponent, {
      data: { messages: messages, notes: notes },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
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
    const dialogRef = this.messageListDialog.open(MessagelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { messages: messages, location: messages[0].location },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '20vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      this.messageService.clearSelectedMessages();
      this.messageService.getByPlusCode(this.mapService.getMapLocation());
      this.updateDataForLocation(this.mapService.getMapLocation(), true);
    });
  }

  public openMarkerNoteListDialog(notes: Note[]) {
    const notesSignal = signal<Note[]>(notes);
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { location: this.mapService.getMapLocation(), notesSignal: notesSignal },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '8rem',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("userNoteList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      this.updateDataForLocation(this.mapService.getMapLocation(), true);
    });
  }

  public editAppSettings() {
    let appSettings: AppSettings = this.appService.getAppSettings();

    const dialogRef = this.userProfileDialog.open(AppSettingsComponent, {
      data: { appSettings: appSettings },
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      autoFocus: false,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((newAppSettings: AppSettings) => {
      if (newAppSettings) {
        this.appService.setAppSettings(newAppSettings);
      }
    });
  }

  public editUserProfile() {
    let profile: Profile = this.userService.getProfile()

    const dialogRef = this.userProfileDialog.open(UserProfileComponent, {
      data: {},
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      this.userService.saveProfile();
    });
  }

  public deleteUser() {
    const dialogRef = this.dialog.open(DeleteUserComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.deleteUser(this.userService.getUser().id)
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) {
                this.userService.logout();
                this.indexedDbService.clearAllData();
                this.updateDataForLocation(this.mapService.getMapLocation(), true)
                this.snackBarRef = this.snackBar.open("User and related data were removed permanently.", undefined, {
                  panelClass: ['snack-success'],
                  horizontalPosition: 'center',
                  verticalPosition: 'top',
                  duration: 3000
                });
              }
            },
            error: (err) => {
              this.snackBarRef = this.snackBar.open("Oops, something went wrong. Please try again later.", undefined, {
                panelClass: ['snack-warning'],
                horizontalPosition: 'center',
                verticalPosition: 'top',
                duration: 2000
              });
            },
            complete: () => { }
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

    dialogRef.afterOpened().subscribe(e => {
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
          const dialogRef = this.dialog.open(WeatherComponent, {
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

          dialogRef.afterOpened().subscribe(e => {
          });

          dialogRef.afterClosed().subscribe();
        },
        error: (err) => {
          const dialogRef = this.displayMessage.open(DisplayMessage, {
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

          dialogRef.afterOpened().subscribe(e => { });

          dialogRef.afterClosed().subscribe(() => {
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
          const dialogRef = this.dialog.open(AirQualityComponent, {
            data: { airQuality: airQualityData },
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
          dialogRef.afterOpened().subscribe();
          dialogRef.afterClosed().subscribe();
        },
        error: (err) => {
          const dialogRef = this.displayMessage.open(DisplayMessage, {
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
          dialogRef.afterClosed().subscribe();
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
            const dialogRef = this.dialog.open(GeoStatisticComponent, {
              data: { geoStatistic: response.result },
              closeOnNavigation: true,
              minWidth: '90vw',
              maxWidth: '90vw',
              minHeight: '20vh',
              height: '90vh',
              maxHeight: '90vh',
              hasBackdrop: true
            });

            dialogRef.afterOpened().subscribe(() => { });

            dialogRef.afterClosed().subscribe(() => { });
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
    const dialogRef = this.displayMessage.open(DisplayMessage, {
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

    dialogRef.afterOpened().subscribe(() => {
      // Optional: Aktionen nach Öffnen
    });

    dialogRef.afterClosed().subscribe(() => {
      // Optional: Aktionen nach Schließen
    });
  }

  async showNominatimSearchDialog() {
    let searchValues: string = await this.indexedDbService.getSetting('nominatimSearch');
    const dialogRef = this.nominatimSearchDialog.open(NominatimSearchComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { location: this.mapService.getMapLocation(), searchValues: undefined != searchValues ? JSON.parse(searchValues) : undefined },
      minWidth: '20vw',
      width: '90vw',
      maxWidth: '90vw',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => { });

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
        this.indexedDbService.setSetting('nominatimSearch', JSON.stringify(result.searchValues));
        switch (result.action) {
          case 'saveSearch':
            this.indexedDbService.setSetting('nominatimSelectedPlace', JSON.stringify(result.selectedPlace));
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
        let plusCode: string = this.geolocationService.getGroupedPlusCodeBasedOnMapZoom(message.location, this.mapService.getMapZoom());
        let plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
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
      let noteLocation: Location = {
        latitude: note.location.latitude,
        longitude: note.location.longitude,
        plusCode: note.location.plusCode
      };
      if (this.mapService.getMapZoom() > 17) {
        center = noteLocation;
      } else {
        let plusCode: string = this.geolocationService.getGroupedPlusCodeBasedOnMapZoom(noteLocation, this.mapService.getMapZoom());
        let plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
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
}
