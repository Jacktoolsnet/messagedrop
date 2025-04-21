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
import { SwPush } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { ContactlistComponent } from './components/contactlist/contactlist.component';
import { EditMessageComponent } from './components/editmessage/edit-message.component';
import { EditNoteComponent } from './components/editnote/edit-note.component';
import { MapComponent } from './components/map/map.component';
import { MultiMarkerComponent } from './components/map/multi-marker/multi-marker.component';
import { MessagelistComponent } from './components/messagelist/messagelist.component';
import { NotelistComponent } from './components/notelist/notelist.component';
import { CheckPinComponent } from './components/pin/check-pin/check-pin.component';
import { CreatePinComponent } from './components/pin/create-pin/create-pin.component';
import { PlacelistComponent } from './components/placelist/placelist.component';
import { DeleteUserComponent } from './components/user/delete-user/delete-user.component';
import { ProfileComponent } from './components/user/profile/profile.component';
import { UserComponent } from './components/user/user.component';
import { WaitComponent } from './components/utils/wait/wait.component';
import { ConfirmUserResponse } from './interfaces/confirm-user-response';
import { Connect } from './interfaces/connect';
import { CreateUserResponse } from './interfaces/create-user-response';
import { CryptedUser } from './interfaces/crypted-user';
import { GetPinHashResponse } from './interfaces/get-pin-hash-response';
import { Location } from './interfaces/location';
import { MarkerLocation } from './interfaces/marker-location';
import { MarkerType } from './interfaces/marker-type';
import { Message } from './interfaces/message';
import { Mode } from './interfaces/mode';
import { MultimediaType } from './interfaces/multimedia-type';
import { Note } from './interfaces/note';
import { Place } from './interfaces/place';
import { ShortNumberPipe } from './pipes/short-number.pipe';
import { ConnectService } from './services/connect.service';
import { ContactService } from './services/contact.service';
import { CryptoService } from './services/crypto.service';
import { GeolocationService } from './services/geolocation.service';
import { IndexedDbService } from './services/indexed-db.service';
import { MapService } from './services/map.service';
import { MessageService } from './services/message.service';
import { NoteService } from './services/note.service';
import { PlaceService } from './services/place.service';
import { ServerService } from './services/server.service';
import { SocketioService } from './services/socketio.service';
import { StatisticService } from './services/statistic.service';
import { UserService } from './services/user.service';

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
    private indexDbService: IndexedDbService,
    private serverService: ServerService,
    public userService: UserService,
    public mapService: MapService,
    public noteService: NoteService,
    public placeService: PlaceService,
    public contactService: ContactService,
    private geolocationService: GeolocationService,
    private connectService: ConnectService,
    private cryptoService: CryptoService,
    private messageService: MessageService,
    private statisticService: StatisticService,
    private socketioService: SocketioService,
    private snackBar: MatSnackBar,
    public createPinDialog: MatDialog,
    public checkPinDialog: MatDialog,
    public messageDialog: MatDialog,
    public noteDialog: MatDialog,
    public messageListDialog: MatDialog,
    public placeListDialog: MatDialog,
    public contactListDialog: MatDialog,
    public userProfileDialog: MatDialog,
    public waitDialog: MatDialog,
    public dialog: MatDialog,
    private platformLocation: PlatformLocation,
    private swPush: SwPush
  ) {
    this.serverSubject = new Subject<void>();
    this.userSubject = new Subject<void>();
    this.contactSubject = new Subject<void>();
    this.mapSubject = new Subject<void>();
    this.serverSubject.subscribe({
      next: async (v) => {
        if (await this.indexDbService.hasUser()) {
          this.openCheckPinDialog();
        } else {
          this.openCreatePinDialog();
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
        this.mapService.initMap(this.mapSubject);
      },
    });
    this.mapSubject.subscribe({
      next: (v) => {
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      },
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
    // Inin the server connection
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
    this.swPush.notificationClicks.subscribe((result) => {
      if (result.notification.data.primaryKey.type === 'place') {
        this.showComponent = true;
        let location: Location = this.geolocationService.getLocationFromPlusCode(result.notification.data.primaryKey.id);
        if (!this.locationReady) {
          this.mapService.flyToWithZoom(location, 19);
        } else {
          this.mapService.flyTo(location);
        }
      }
      if (result.notification.data.primaryKey.type === 'contact') {
        this.openContactListDialog();
      }
    });
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

  private setIsUserLocation(): void {
    if (this.userService.getUser().location.plusCode === this.mapService.getMapLocation().plusCode) {
      this.isUserLocation = true;
    } else {
      this.isUserLocation = false;
    }
  }

  public startWatchingPosition() {
    this.initWatchingPosition = true;
    this.watchPosition();
  }

  public goToUserLocation() {
    this.mapService.flyTo(this.userService.getUser().location);
  }

  private watchPosition() {
    this.geolocationService.watchPosition().subscribe({
      next: (position) => {
        this.locationReady = true;
        this.userService.getUser().location.latitude = position.coords.latitude;
        this.userService.getUser().location.longitude = position.coords.longitude;
        this.userService.getUser().location.plusCode = this.geolocationService.getPlusCode(position.coords.latitude, position.coords.longitude)
        this.userService.saveUser();
        this.mapService.setUserMarker(this.userService.getUser().location);
        if (this.initWatchingPosition) {
          this.mapService.flyToWithZoom(this.userService.getUser().location, 19);
          this.initWatchingPosition = false;
        }
      },
      error: (error) => {
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
          this.watchPosition();
        });
      }
    });
  }

  private getMessages(location: Location) {
    this.messageService.getByPlusCode(location, this.messageSubject);
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
        this.getMessages(location);
        // MarkerLocations
        this.createMarkerLocations();
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
    this.mapService.flyTo({
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
    this.mapService.flyTo(event);
  }

  public openCreatePinDialog(): void {
    const dialogRef = this.createPinDialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: false
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(async (data: any) => {
      const waitDialogRef = this.waitDialog.open(WaitComponent, {
        data: { title: 'User creation', message: `Creating user` },
        closeOnNavigation: false,
        hasBackdrop: false
      });
      const encrypted = await this.cryptoService.encrypt(
        this.serverService.getCryptoPublicKey()!,
        data
      );

      this.userService.getPinHash(encrypted).subscribe({
        next: (getPinHashResponse: GetPinHashResponse) => {
          this.userService.getUser().pinHash = getPinHashResponse.pinHash;

          this.userService.createUser().subscribe({
            next: (createUserResponse: CreateUserResponse) => {
              this.userService.initUser(this.userSubject, createUserResponse);
            },
            error: (err) => {
              waitDialogRef.close();
            },
            complete: () => {
              waitDialogRef.close();
            }
          });
        },
        error: (err) => {
          waitDialogRef.close();
        },
        complete: () => {
          waitDialogRef.close();
        }
      });
    });
  }

  public openCheckPinDialog(): void {
    const dialogRef = this.checkPinDialog.open(CheckPinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: false
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageDialog");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe(async (data: any) => {
      if (data === undefined) {
        let cryptedUser: CryptedUser | undefined = await this.indexDbService.getUser()
        if (cryptedUser) {
          this.userService.deleteUser(cryptedUser.id)
            .subscribe({
              next: () => {
                this.indexDbService.clearAllData();
                this.openCreatePinDialog();
              },
              error: (err) => {
                this.indexDbService.clearAllData();
                this.openCreatePinDialog();
              },
              complete: () => { }
            });
        }
      } else {
        const waitDialogRef = this.waitDialog.open(WaitComponent, {
          data: { title: 'PIN Verification', message: `Verifying PIN` },
          closeOnNavigation: false,
          hasBackdrop: false
        });
        this.userService.getPinHash(await this.cryptoService.encrypt(this.serverService.getCryptoPublicKey()!, data))
          .subscribe(async (getPinHashResponse: GetPinHashResponse) => {
            this.userService.getUser().pinHash = getPinHashResponse.pinHash;
            const cryptedUser = await this.indexDbService.getUser();
            if (cryptedUser) {
              this.userService.confirmUser(getPinHashResponse.pinHash, cryptedUser)
                .subscribe({
                  next: (confirmUserResponse: ConfirmUserResponse) => {
                    this.userService.setUser(this.userSubject, confirmUserResponse.user);
                    waitDialogRef.close();
                  },
                  error: (err) => {
                    waitDialogRef.close();
                    if (err.status === 401) {
                      this.snackBarRef = this.snackBar.open("Pin is not correct. Please try again.", undefined, {
                        panelClass: ['snack-warning'],
                        horizontalPosition: 'center',
                        verticalPosition: 'top',
                        duration: 3000
                      });
                      this.openCheckPinDialog();
                    } else if (err.status === 404) {
                      this.snackBarRef = this.snackBar.open("User did not exist anymore. Please create a new user.", undefined, {
                        panelClass: ['snack-warning'],
                        horizontalPosition: 'center',
                        verticalPosition: 'top',
                        duration: 3000
                      });
                      this.userService.deleteUser(cryptedUser.id)
                        .subscribe({
                          next: () => {
                            this.indexDbService.clearAllData();
                            this.openCreatePinDialog();
                          },
                          error: (err) => {
                            this.indexDbService.clearAllData();
                            this.openCreatePinDialog();
                          },
                          complete: () => { }
                        });
                    } else {
                      this.snackBarRef = this.snackBar.open("Oops, something went wrong. Please try again later.", undefined, {
                        panelClass: ['snack-warning'],
                        horizontalPosition: 'center',
                        verticalPosition: 'top',
                        duration: 3000
                      });
                    }
                  }
                });
            }
          });
      }
    });
  }

  public openMessagDialog(): void {
    let message: Message = {
      id: 0,
      parentId: 0,
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
      latitude: 0,
      longitude: 0,
      plusCode: '',
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

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, message: message },
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
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
      }
    });
  }

  public openNoteDialog(): void {
    let note: Note = {
      latitude: 0,
      longitude: 0,
      plusCode: '',
      note: '',
      markerType: 'note',
      style: '',
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
    const dialogRef = this.noteDialog.open(EditNoteComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_NOTE, user: this.userService.getUser(), note: note },
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
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
            width: 'auto',
            minWidth: '60vw',
            maxWidth: '90vw',
            height: 'auto',
            minHeight: 'auto',
            maxHeight: '90vh',
            hasBackdrop: true
          });

          dialogRef.afterOpened().subscribe(e => {
            this.myHistory.push("userMessageList");
            window.history.replaceState(this.myHistory, '', '');
          });

          dialogRef.afterClosed().subscribe((data: any) => {
            this.messageService.clearSelectedMessages();
            this.getMessages(this.mapService.getMapLocation());
          });
        },
        error: (err) => {
          this.messageService.clearMessages();
          this.snackBarRef = this.snackBar.open("You have not written any messages yet", undefined, {
            panelClass: ['snack-warning'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 2000
          });
        },
        complete: () => { }
      });
  }

  public openUserNoteListDialog(): void {
    if (this.noteService.loadNotes().length === 0) {
      this.snackBarRef = this.snackBar.open("You have not written any note yet", undefined, {
        panelClass: ['snack-warning'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 2000
      });
    } else {
      const dialogRef = this.messageListDialog.open(NotelistComponent, {
        panelClass: 'NoteListDialog',
        closeOnNavigation: true,
        data: { notes: this.noteService.loadNotes() },
        width: 'auto',
        minWidth: '60vw',
        maxWidth: '90vw',
        height: 'auto',
        minHeight: 'auto',
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
  }

  public openPlaceListDialog(): void {
    const dialogRef = this.placeListDialog.open(PlacelistComponent, {
      panelClass: 'PalceListDialog',
      closeOnNavigation: true,
      data: { user: this.userService.getUser(), places: this.placeService.getPlaces() },
      width: 'auto',
      minWidth: '60vw',
      maxWidth: '90vw',
      height: 'auto',
      minHeight: 'auto',
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
      data: { user: this.userService.getUser(), contacts: this.contactService.getContacts() },
      width: 'auto',
      minWidth: '60vw',
      maxWidth: '90vw',
      height: 'auto',
      minHeight: 'auto',
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
      width: 'auto',
      minWidth: '60vw',
      maxWidth: '90vw',
      height: 'auto',
      minHeight: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
      this.myHistory.push("messageList");
      window.history.replaceState(this.myHistory, '', '');
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      this.messageService.clearSelectedMessages();
      this.getMessages(this.mapService.getMapLocation());
    });
  }

  public openMarkerNoteListDialog(notes: Note[]) {
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { notes: notes },
      width: 'auto',
      minWidth: '60vw',
      maxWidth: '90vw',
      height: 'auto',
      minHeight: 'auto',
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
      data: { user: this.userService.getUser() },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.saveUser();
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
                this.indexDbService.clearAllData();
                this.getMessages(this.mapService.getMapLocation());
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
      data: { user: this.userService.getUser() },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      switch (result?.action) {
        case "shareUserId":
          this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, this.userService.getUser().id)
            .then((signature: string) => {
              this.cryptoService.encrypt(this.userService.getUser().cryptoKeyPair.publicKey, result?.connectHint)
                .then((encryptedHint: string) => {
                  let connect: Connect = {
                    id: '',
                    userId: this.userService.getUser().id,
                    hint: encryptedHint,
                    signature: signature,
                    encryptionPublicKey: JSON.stringify(this.userService.getUser().cryptoKeyPair?.publicKey!),
                    signingPublicKey: JSON.stringify(this.userService.getUser().signingKeyPair?.publicKey!)
                  };
                  this.connectService.createConnect(connect)
                    .subscribe({
                      next: createConnectResponse => {
                        if (createConnectResponse.status === 200) {
                          connect.id = createConnectResponse.connectId;
                          navigator.clipboard.writeText(connect.id);
                          this.snackBarRef = this.snackBar.open(`The connect id has been copied to the clipboard. I share the connect id only via services and with people I trust.`, 'OK', {});
                        }
                      },
                      error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                      complete: () => { }
                    });
                });
            });
          break
        case "deleteUserId":
          this.deleteUser();
          break
      }
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
