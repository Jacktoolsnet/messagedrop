import { CommonModule, PlatformLocation } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterOutlet } from '@angular/router';
import { Subject, take } from 'rxjs';
import { AirQualityComponent } from './components/air-quality/air-quality.component';
import { ContactlistComponent } from './components/contactlist/contactlist.component';
import { EditMessageComponent } from './components/editmessage/edit-message.component';
import { EditNoteComponent } from './components/editnote/edit-note.component';
import { GeoStatisticComponent } from './components/geo-statistic/geo-statistic.component';
import { MapComponent } from './components/map/map.component';
import { MultiMarkerComponent } from './components/map/multi-marker/multi-marker.component';
import { MessagelistComponent } from './components/messagelist/messagelist.component';
import { NotelistComponent } from './components/notelist/notelist.component';
import { CheckPinComponent } from './components/pin/check-pin/check-pin.component';
import { CreatePinComponent } from './components/pin/create-pin/create-pin.component';
import { PlacelistComponent } from './components/placelist/placelist.component';
import { SharedContentComponent } from './components/shared-content/shared-content.component';
import { DeleteUserComponent } from './components/user/delete-user/delete-user.component';
import { ProfileComponent } from './components/user/profile/profile.component';
import { UserComponent } from './components/user/user.component';
import { DisplayMessage } from './components/utils/display-message/display-message.component';
import { WeatherComponent } from './components/weather/weather.component';
import { ConfirmUserResponse } from './interfaces/confirm-user-response';
import { CreateUserResponse } from './interfaces/create-user-response';
import { CryptedUser } from './interfaces/crypted-user';
import { GetGeoStatisticResponse } from './interfaces/get-geo-statistic-response';
import { GetPinHashResponse } from './interfaces/get-pin-hash-response';
import { Location } from './interfaces/location';
import { MarkerLocation } from './interfaces/marker-location';
import { MarkerType } from './interfaces/marker-type';
import { Message } from './interfaces/message';
import { Mode } from './interfaces/mode';
import { Multimedia } from './interfaces/multimedia';
import { MultimediaType } from './interfaces/multimedia-type';
import { Note } from './interfaces/note';
import { NotificationAction } from './interfaces/notification-action';
import { Place } from './interfaces/place';
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
  private serverSubject: Subject<void>;
  private userSubject: Subject<void>;
  private contactSubject: Subject<void>;
  private messageSubject: Subject<void>;
  private mapSubject: Subject<void>;
  private showComponent: boolean = false;


  constructor(
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
    public createPinDialog: MatDialog,
    public checkPinDialog: MatDialog,
    public messageDialog: MatDialog,
    public noteDialog: MatDialog,
    public messageListDialog: MatDialog,
    public placeListDialog: MatDialog,
    public contactListDialog: MatDialog,
    public userProfileDialog: MatDialog,
    public displayMessage: MatDialog,
    public sharedContentDialog: MatDialog,
    public dialog: MatDialog,
    private platformLocation: PlatformLocation
  ) {
    this.serverSubject = new Subject<void>();
    this.userSubject = new Subject<void>();
    this.contactSubject = new Subject<void>();
    this.mapSubject = new Subject<void>();

    this.serverSubject.subscribe({
      next: async (v) => {
        if (this.serverService.isReady()) {
          // Init the map
          this.mapService.initMap(this.mapSubject);
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
            hasBackdrop: false
          });

          dialogRef.afterOpened().subscribe(e => { });

          dialogRef.afterClosed().subscribe(() => {
            this.initApp();
          });
        }
      },
    });

    this.userSubject.subscribe({
      next: (v) => {
        this.contactService.initContacts(this.contactSubject);
      },
    });

    this.contactSubject.subscribe({
      next: (v) => {
        this.socketioService.initSocket();
        this.placeService.initPlaces();
      },
    });

    this.mapSubject.subscribe({
      next: (v) => {
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

    this.messageSubject = new Subject<void>();
    this.messageSubject.subscribe({
      next: (v) => {
        this.createMarkerLocations()
        if (this.showComponent && this.messageService.getMessages().length != 0) {
          this.showComponent = false;
          this.openMarkerMessageListDialog(this.messageService.getMessages());
        }
      },
    });

    this.initApp();
  }

  async initApp() {
    // Check network
    this.networkService.init();
    // Init the server connection
    this.serverService.init(this.serverSubject);
    // Count
    this.statisticService.countVisitor()
      .subscribe({
        next: (data) => { },
        error: (err) => { },
        complete: () => { }
      });
  }

  public ngOnInit(): void {
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

  public async login() {
    if (await this.indexedDbService.hasUser()) {
      this.openCheckPinDialog();
    } else {
      const dialogRef = this.displayMessage.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: 'Want to create a user? Easy peasy.',
          image: '',
          icon: 'person_add',
          message: `Just pick a PIN – no username, no password, no DNA sample.

But hey, *don’t forget that PIN!*

We don’t store it, we don’t back it up, and we definitely can’t send you a “forgot PIN?” email.  
Basically: lose it, and your user is gone like your last cup of coffee.

You can delete your user anytime (rage quit or just Marie Kondo your data).

Also, if you ghost us for 90 days, your user and all its data get quietly deleted.`,
          button: 'Create PIN',
          delay: 200,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true
      });

      dialogRef.afterOpened().subscribe(e => { });

      dialogRef.afterClosed().subscribe(() => {
        this.openCreatePinDialog();
      });
    }
  }

  public logout() {
    this.userService.logout()
    this.placeService.logout();
    this.contactService.logout();
  }

  public handleSharedContentOrNotification() {
    // Check if app is called from shared dialog or from push notification

    // Observe shared content
    this.sharedContentService.getSharedAvailableObservable().subscribe(async (sharedAvaliable: boolean) => {
      if (sharedAvaliable) {
        const lastContent = await this.sharedContentService.getSharedContent('last');
        let multimedia: Multimedia | undefined = undefined;
        let location: Location | undefined = undefined;
        if (lastContent?.url) {
          const objectFromUrl = await this.oembedService.getObjectFromUrl(lastContent.url);
          if (objectFromUrl && this.oembedService.isMultimedia(objectFromUrl)) {
            multimedia = objectFromUrl as Multimedia;
          } else if (objectFromUrl && this.oembedService.isLocation(objectFromUrl)) {
            location = objectFromUrl as Location;
          } else {
            this.snackBar.open(JSON.stringify(lastContent, null, 2), 'OK', {
              horizontalPosition: 'center',
              verticalPosition: 'top',
            });
          }
        }
        const dialogRef = this.sharedContentDialog.open(SharedContentComponent, {
          data: { multimedia: multimedia, location: location },
          closeOnNavigation: true,
          minWidth: '20vw',
          maxWidth: '90vw',
          maxHeight: '90vh',
          hasBackdrop: true
        });

        dialogRef.afterOpened().subscribe(e => {
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.userService.saveProfile();
          }
        });
      }
    });
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
        message: 'Please wait while we determine your current location...',
        button: '',
        delay: 0,
        showSpinner: true
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true
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
          this.mapService.moveToWithZoom(this.userService.getUser().location, 19);
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
          this.snackBarRef.afterDismissed().subscribe(() => {
            this.getCurrentPosition();
          });
        }
      });
    });

    dialogRef.afterClosed().subscribe(() => {
      // Optional: Aktionen nach Schließen
    });

  }

  public addLocationToPlace() {
    let location: Location = this.mapService.getMapLocation();
    this.placeService.addPlusCodeToPlace(this.placeService.getSelectedPlace(), location, this.isPartOfPlace, this.mapService);
  }

  public removeLocationFromPlace() {
    let location: Location = this.mapService.getMapLocation();
    this.placeService.removePlusCodeFromPlace(this.placeService.getSelectedPlace()!, location, this.isPartOfPlace, this.mapService);
  }

  public finishEditingPlace() {
    this.mapService.setMapMinMaxZoom(3, 19);
    this.placeService.getSelectedPlace().id = '';
    this.placeService.getSelectedPlace().userId = '';
    this.placeService.getSelectedPlace().name = '';
    this.placeService.getSelectedPlace().subscribed = false;
    this.placeService.getSelectedPlace().plusCodes = [];
    this.mapService.removeAllPlaceLocationRectange();
    this.updateDataForLocation(this.mapService.getMapLocation(), true)
  }

  private updateDataForLocation(location: Location, forceSearch: boolean) {
    if (this.placeService.getSelectedPlace().plusCodes.length > 0) {
      this.isPartOfPlace = this.placeService.getSelectedPlace().plusCodes.some(element => element === this.mapService.getMapLocation().plusCode);
    } else {
      if (this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom()) !== this.messageService.getLastSearchedLocation() || forceSearch) {
        // Clear markerLocations
        this.markerLocations.clear()
        // notes from local device
        this.noteService.filter(location.plusCode);
        // Messages
        this.messageService.getByPlusCode(location, this.messageSubject);
      } else {
        //this.createMarkerLocations();
      }
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

  public handleMarkerClickEvent(event: any) {
    this.mapService.moveTo({
      latitude: event.latitude,
      longitude: event.longitude,
      plusCode: event.plusCode
    });
    switch (event.type) {
      case MarkerType.PUBLIC_MESSAGE:
        this.openMarkerMessageListDialog(this.messageService.getMessages());
        break;
      case MarkerType.PRIVATE_NOTE:
        this.openMarkerNoteListDialog(this.noteService.filter(event.plusCode));
        break;
      case MarkerType.MULTI:
        let messages: Message[] = this.messageService.getMessages().filter((message) => message.plusCode === event.plusCode);
        let notes: Note[] = this.noteService.filter(event.plusCode);
        this.openMarkerMultiDialog(this.messageService.getMessages(), this.noteService.getNotes());
        break;
    }
  }

  public handleClickEvent(event: Location) {
    this.mapService.moveTo(event);
  }

  public openCreatePinDialog(): void {
    const dialogRef = this.createPinDialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().pipe(take(1)).subscribe(async (data: any) => {

      const encrypted = await this.cryptoService.encrypt(
        this.serverService.getCryptoPublicKey()!,
        data
      );

      this.userService.getPinHash(encrypted).subscribe({
        next: (getPinHashResponse: GetPinHashResponse) => {
          this.userService.getUser().pinHash = getPinHashResponse.pinHash;

          this.userService.createUser().subscribe({
            next: (createUserResponse: CreateUserResponse) => {
              this.userService.initUser(this.userSubject, createUserResponse, getPinHashResponse.pinHash);
            },
            error: (err) => { },
            complete: () => { }
          });
        },
        error: (err) => { },
        complete: () => { }
      });
    });
  }

  public openCheckPinDialog(): void {
    const dialogRef = this.checkPinDialog.open(CheckPinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(async (data: any) => {
      console.log('Pin entered: ', data);
      if (data === 'reset') {
        let cryptedUser: CryptedUser | undefined = await this.indexedDbService.getUser()
        if (cryptedUser) {
          this.userService.deleteUser(cryptedUser.id)
            .subscribe({
              next: () => {
                this.indexedDbService.clearAllData();
                this.openCreatePinDialog();
              },
              error: (err) => {
                this.indexedDbService.clearAllData();
                this.openCreatePinDialog();
              },
              complete: () => { }
            });
        }
      } else {
        this.userService.getPinHash(await this.cryptoService.encrypt(this.serverService.getCryptoPublicKey()!, data))
          .subscribe(async (getPinHashResponse: GetPinHashResponse) => {
            this.userService.getUser().pinHash = getPinHashResponse.pinHash;
            const cryptedUser = await this.indexedDbService.getUser();
            if (cryptedUser) {
              this.userService.confirmUser(getPinHashResponse.pinHash, cryptedUser)
                .subscribe({
                  next: (confirmUserResponse: ConfirmUserResponse) => {
                    this.userService.setUser(this.userSubject, confirmUserResponse.user);
                  },
                  error: (err) => {
                    if (err.status === 401) {
                      this.snackBarRef = this.snackBar.open("Pin is not correct. Please try again.", undefined, {
                        panelClass: ['snack-warning'],
                        horizontalPosition: 'center',
                        verticalPosition: 'top',
                        duration: 3000
                      });
                    } else if (err.status === 404) {
                      const dialogRef = this.displayMessage.open(DisplayMessage, {
                        panelClass: '',
                        closeOnNavigation: false,
                        data: {
                          showAlways: true,
                          title: 'User not found',
                          image: '',
                          icon: 'person_remove',
                          message: `Looks like this user has been inactive for a while. 
                          
                          To keep things clean and simple, users are automatically deleted after 90 days of inactivity.
                          
                          You can create a new one anytime — no signup, no hassle.`,
                          button: 'Create new user',
                          delay: 200,
                          showSpinner: false
                        },
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        hasBackdrop: true
                      });

                      dialogRef.afterOpened().subscribe(e => { });

                      dialogRef.afterClosed().subscribe(() => {
                        this.userService.deleteUser(cryptedUser.id)
                          .subscribe({
                            next: () => {
                              this.indexedDbService.clearAllData();
                            },
                            error: (err) => {
                              this.indexedDbService.clearAllData();
                            },
                            complete: () => { this.initApp(); }
                          });
                      });
                    } else {
                      const dialogRef = this.displayMessage.open(DisplayMessage, {
                        panelClass: '',
                        closeOnNavigation: false,
                        data: {
                          showAlways: true,
                          title: 'Oops! Backend error!',
                          image: '',
                          icon: 'bug_report',
                          message: 'Something went wrong. Please try again later.',
                          button: 'Retry...',
                          delay: 10000,
                          showSpinner: false
                        },
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        hasBackdrop: true
                      });

                      dialogRef.afterOpened().subscribe(e => { });

                      dialogRef.afterClosed().subscribe(() => {
                        this.initApp();
                      });
                    }
                  }
                });
            }
          });
      }
    });
  }

  async openMessagDialog(): Promise<void> {
    const lastMultimediaContent = await this.sharedContentService.getSharedContent('lastMultimedia');
    let lastMultimedia: Multimedia | undefined = undefined;
    if (undefined != lastMultimediaContent) {
      lastMultimedia = await this.oembedService.getObjectFromUrl(lastMultimediaContent!.url) as Multimedia;
    }
    const lastLocationContent = await this.sharedContentService.getSharedContent('lastLocation');
    let lastLocation: Location | undefined = undefined;
    if (undefined != lastLocationContent) {
      lastLocation = await this.oembedService.getObjectFromUrl(lastLocationContent!.url) as Location;
      if (undefined != lastLocation) {
        this.mapService.flyToWithZoom(lastLocation, 19);
      }
    }
    let message: Message = {
      id: 0,
      parentId: 0,
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
      latitude: 0,
      longitude: 0,
      plusCode: '',
      message: undefined != lastMultimediaContent ? lastMultimediaContent.text : '',
      markerType: 'default',
      style: '',
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: [],
      commentsNumber: 0,
      status: 'enabled',
      userId: '',
      multimedia: undefined != lastMultimedia ? lastMultimedia : {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, message: message, lastLocation: lastLocation },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.message) {
        this.messageService.createMessage(data.message, this.mapService.getMapLocation(), this.userService.getUser());
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
        this.sharedContentService.deleteSharedContent('last');
        this.sharedContentService.deleteSharedContent('lastMultimedia');
        this.sharedContentService.deleteSharedContent('lastLocation');
      }
    });
  }

  async openNoteDialog(): Promise<void> {
    const lastMultimediaContent = await this.sharedContentService.getSharedContent('lastMultimedia');
    let lastMultimedia: Multimedia | undefined = undefined;
    if (undefined != lastMultimediaContent) {
      lastMultimedia = await this.oembedService.getObjectFromUrl(lastMultimediaContent!.url) as Multimedia;
    }
    const lastLocationContent = await this.sharedContentService.getSharedContent('lastLocation');
    let lastLocation: Location | undefined = undefined;
    if (undefined != lastLocationContent) {
      lastLocation = await this.oembedService.getObjectFromUrl(lastLocationContent!.url) as Location;
      if (undefined != lastLocation) {
        this.mapService.flyToWithZoom(lastLocation, 19);
      }
    }
    let note: Note = {
      latitude: 0,
      longitude: 0,
      plusCode: '',
      note: '',
      markerType: 'note',
      style: '',
      multimedia: undefined != lastMultimedia ? lastMultimedia : {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };

    const dialogRef = this.noteDialog.open(EditNoteComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_NOTE, user: this.userService.getUser(), note: note, lastLocation: lastLocation },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true
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
        this.noteService.saveNotes();
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
        this.sharedContentService.deleteSharedContent('last');
        this.sharedContentService.deleteSharedContent('lastMultimedia');
        this.sharedContentService.deleteSharedContent('lastLocation');
      }
    });
  }

  public openUserMessagListDialog(): void {
    this.userService.getUserMessages(this.userService.getUser())
      .subscribe({
        next: (getMessageResponse) => {
          this.messageService.setMessages(getMessageResponse.rows)
          const dialogRef = this.messageListDialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { messages: this.messageService.getMessages() },
            minWidth: '20vw',
            maxWidth: '90vw',
            minHeight: '8rem',
            maxHeight: '90vh',
            hasBackdrop: true
          });

          dialogRef.afterOpened().subscribe(e => {
            this.myHistory.push("userMessageList");
            window.history.replaceState(this.myHistory, '', '');
          });

          dialogRef.afterClosed().subscribe((data: any) => {
            this.messageService.clearSelectedMessages();
            this.messageService.getByPlusCode(this.mapService.getMapLocation(), this.messageSubject);
          });
        },
        error: (err) => {
          this.messageService.clearMessages();
          const dialogRef = this.messageListDialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { messages: this.messageService.getMessages() },
            minWidth: '20vw',
            maxWidth: '90vw',
            minHeight: '8rem',
            maxHeight: '90vh',
            hasBackdrop: true
          });

          dialogRef.afterOpened().subscribe(e => {
            this.myHistory.push("userMessageList");
            window.history.replaceState(this.myHistory, '', '');
          });

          dialogRef.afterClosed().subscribe((data: any) => {
            this.messageService.clearSelectedMessages();
            this.messageService.getByPlusCode(this.mapService.getMapLocation(), this.messageSubject);
          });
        },
        complete: () => { }
      });
  }

  public openUserNoteListDialog(): void {
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'NoteListDialog',
      closeOnNavigation: true,
      data: { notes: this.noteService.loadNotes() },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '8rem',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("userNoteList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
    });
  }

  public openPlaceListDialog(): void {
    const dialogRef = this.placeListDialog.open(PlacelistComponent, {
      panelClass: 'PalceListDialog',
      closeOnNavigation: true,
      data: { places: this.placeService.getPlaces() },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '8rem',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("placeList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: Place) => {
      if (undefined != data) {
        this.messageService.clearMessages();
        this.markerLocations.clear()
        this.createMarkerLocations()
        this.mapService.setMapMinMaxZoom(18, 19);
        this.placeService.getSelectedPlace().id = data.id;
        this.placeService.getSelectedPlace().userId = data.userId;
        this.placeService.getSelectedPlace().name = data.name;
        this.placeService.getSelectedPlace().subscribed = data.subscribed;
        this.placeService.getSelectedPlace().plusCodes = data.plusCodes;
        this.placeService.getSelectedPlace().plusCodes?.forEach(plusCode => {
          this.mapService.addPlaceLocationRectange(this.geolocationService.getLocationFromPlusCode(plusCode));
        });
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
        if (this.placeService.getSelectedPlace().plusCodes.length != 0) {
          let location: Location = this.geolocationService.getLocationFromPlusCode(this.placeService.getSelectedPlace().plusCodes[0]);
          this.mapService.flyToWithZoom(location, 18);
        }
      }
    });
  }

  public openContactListDialog(): void {
    const dialogRef = this.contactListDialog.open(ContactlistComponent, {
      panelClass: 'ContactListDialog',
      closeOnNavigation: true,
      data: { contacts: this.contactService.getContacts() },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '8rem',
      maxHeight: '90vh',
      hasBackdrop: true
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
      data: { messages: messages },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '20vh',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      this.messageService.clearSelectedMessages();
      this.messageService.getByPlusCode(this.mapService.getMapLocation(), this.messageSubject);
    });
  }

  public openMarkerNoteListDialog(notes: Note[]) {
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { notes: notes },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '8rem',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("userNoteList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
    });
  }

  public editUserProfile() {
    const dialogRef = this.userProfileDialog.open(ProfileComponent, {
      data: {},
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.saveProfile();
      }
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
                this.indexedDbService.clearAllData();
                this.messageService.getByPlusCode(this.mapService.getMapLocation(), this.messageSubject);
              }
            },
            error: (err) => {
              this.snackBarRef = this.snackBar.open("Oops, something went wrong. Please try again later.", undefined, {
                panelClass: ['snack-warning'],
                horizontalPosition: 'center',
                verticalPosition: 'top',
                duration: 1000
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
        this.mapService.getMapLocation().latitude,
        this.mapService.getMapLocation().longitude,
        3
      )
      .subscribe({
        next: (weather) => {
          const dialogRef = this.dialog.open(WeatherComponent, {
            data: { weather: weather },
            closeOnNavigation: true,
            minWidth: '90vw',
            maxWidth: '90vw',
            minHeight: '20vh',
            maxHeight: '90vh',
            hasBackdrop: true
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
              title: err.statusText,
              image: '',
              icon: 'hourglass_bottom',
              message: err.error?.error,
              button: '',
              delay: 0,
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
            maxWidth: '90vw',
            minHeight: '20vh',
            maxHeight: '90vh',
            hasBackdrop: true
          });
          dialogRef.afterOpened().subscribe();
          dialogRef.afterClosed().subscribe();
        },
        error: (err) => {
          const dialogRef = this.displayMessage.open(DisplayMessage, {
            data: {
              showAlways: true,
              title: err.statusText || 'Error',
              icon: 'error',
              message: err.error?.error || 'Failed to load air quality data.',
              showSpinner: false
            },
            maxWidth: '90vw',
            maxHeight: '90vh',
            hasBackdrop: true
          });
          dialogRef.afterClosed().subscribe();
        }
      });
  }

  public showGeoStatistic() {
    this.geoStatisticService
      .getDataForLocation(
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
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(() => {
      // Optional: Aktionen nach Öffnen
    });

    dialogRef.afterClosed().subscribe(() => {
      // Optional: Aktionen nach Schließen
    });
  }

  private createMarkerLocations() {
    let key: string = "";
    this.markerLocations.clear();
    let center: number[] = [];
    // Process messages
    this.messageService.getMessages().forEach((message) => {
      let location: Location = {
        latitude: message.latitude,
        longitude: message.longitude,
        plusCode: message.plusCode
      };
      key = this.createMarkerKey(location);
      if (this.mapService.getMapZoom() > 19) {
        center = [message.latitude, message.longitude]
      } else {
        center = this.mapService.getSearchRectangeCenter(location);
      }
      if (!this.markerLocations.has(key)) {
        this.markerLocations.set(key, {
          latitude: center[0],
          longitude: center[1],
          plusCode: message.plusCode,
          type: MarkerType.PUBLIC_MESSAGE
        });
      }
    });
    // Process notes
    this.noteService.getNotes().forEach((note) => {
      let location: Location = {
        latitude: note.latitude,
        longitude: note.longitude,
        plusCode: note.plusCode
      };
      key = this.createMarkerKey(location);
      if (this.mapService.getMapZoom() > 19) {
        center = [note.latitude, note.longitude]
      } else {
        center = this.mapService.getSearchRectangeCenter(location);
      }
      if (this.markerLocations.has(key)) {
        if (this.markerLocations.get(key)?.type != MarkerType.PRIVATE_NOTE) {
          this.markerLocations.set(key, {
            latitude: center[0],
            longitude: center[1],
            plusCode: note.plusCode,
            type: MarkerType.MULTI
          });
        }
      } else {
        this.markerLocations.set(key, {
          latitude: center[0],
          longitude: center[1],
          plusCode: note.plusCode,
          type: MarkerType.PRIVATE_NOTE
        });
      }
    });
    // Save last markerupdet to fire the angular change listener
    this.lastMarkerUpdate = new Date().getMilliseconds();
  }

  private createMarkerKey(location: Location): string {
    if (this.mapService.getMapZoom() > 19) {
      return location.plusCode;
    } else {
      return this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom());
    }
  }


}
