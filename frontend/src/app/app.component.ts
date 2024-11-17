import { Component, OnInit } from '@angular/core';
import { CommonModule, PlatformLocation } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './components/map/map.component';
import { GeolocationService } from './services/geolocation.service';
import { Location } from './interfaces/location';
import { UserService } from './services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MessageComponent } from './components/message/message.component';
import { MessageService } from './services/message.service';
import { StatisticService } from './services/statistic.service';
import { MatBadgeModule } from '@angular/material/badge';
import { Message } from './interfaces/message';
import { Note } from './interfaces/note';
import { MessagelistComponent } from './components/messagelist/messagelist.component';
import { MapService } from './services/map.service';
import { ShortNumberPipe } from './pipes/short-number.pipe';
import { ProfileComponent } from './components/user/profile/profile.component';
import { Mode } from './interfaces/mode';
import { DeleteUserComponent } from './components/user/delete-user/delete-user.component';
import { NoteComponent } from './components/note/note.component';
import { NoteService } from './services/note.service';
import { NotelistComponent } from './components/notelist/notelist.component';
import { MarkerLocation } from './interfaces/marker-location';
import { MarkerType } from './interfaces/marker-type';
import { MultiMarkerComponent } from './components/map/multi-marker/multi-marker.component';
import { PlacelistComponent } from './components/placelist/placelist.component';
import { PlaceService } from './services/place.service';
import { Place } from './interfaces/place';
import { SwPush } from '@angular/service-worker';
import { UserComponent } from './components/user/user.component';
import { ConnectService } from './services/connect.service';
import { Connect } from './interfaces/connect';
import { ContactlistComponent } from './components/contactlist/contactlist.component';
import { CryptoService } from './services/crypto.service';
import { ContactService } from './services/contact.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    MatBadgeModule,
    CommonModule,
    RouterOutlet,
    MapComponent,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    ShortNumberPipe,
    MatMenuModule,
    MatButtonModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  public locationReady: boolean = false;
  public myHistory: string[] = [];
  public notes: Note[] = [];
  public allUserNotes: Note[] = [];
  public markerLocations: Map<string, MarkerLocation> = new Map<string, MarkerLocation>();
  private snackBarRef: any;
  public isUserLocation: boolean = false;
  public initWatchingPosition: boolean = false;
  public mode: typeof Mode = Mode;
  public lastMarkerUpdate: number = 0;
  public locationSubscriptionError: boolean = false;
  public isPartOfPlace: boolean = false;
  private messageSubject: Subject<void>;
  private notesSubject: Subject<void>;

  constructor(
    public mapService: MapService,
    private geolocationService: GeolocationService,
    public userService: UserService,
    private connectService: ConnectService,
    private cryptoService: CryptoService,
    private messageService: MessageService,
    private noteService: NoteService,
    public placeService: PlaceService,
    public contactService: ContactService,
    private statisticService: StatisticService,
    private snackBar: MatSnackBar,
    public messageDialog: MatDialog,
    public noteDialog: MatDialog,
    public messageListDialog: MatDialog,
    public placeListDialog: MatDialog,
    public contactListDialog: MatDialog,
    public userProfileDialog: MatDialog,
    public dialog: MatDialog,
    private platformLocation: PlatformLocation,
    private swPush: SwPush
  ) {
    this.messageSubject = new Subject<void>();
    this.messageSubject.subscribe({
      next: (v) => this.createMarkerLocations(),
    });
    this.notesSubject = new Subject<void>();
    this.notesSubject.subscribe({
      next: (v) => this.createMarkerLocations(),
    });
    this.initApp();
  }

  private async initApp() {
    while (!this.mapService.isReady()) {
      await new Promise(f => setTimeout(f, 500));
    }
    this.updateDataForLocation(this.mapService.getMapLocation(), true)
    this.allUserNotes = [...this.noteService.loadNotesFromStorage()];
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
      if (result.notification.data.primaryKey.type = 'place') {
        let location: Location = this.geolocationService.getLocationFromPlusCode(result.notification.data.primaryKey.id);
        this.getMessages(location, true, true);
        if (!this.locationReady) {
          this.mapService.flyToWithZoom(location, 19);
        } else {
          this.mapService.flyTo(location);
        }
      }
      if (result.notification.data.primaryKey.type = 'contact') {
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
        this.userService.saveUser(this.userService.getUser());
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

  private getMessages(location: Location, forceSearch: boolean, showMessageList: boolean) {
    this.messageService.getByPlusCode(location, this.messageSubject);
    if (showMessageList) {
      this.openMarkerMessageListDialog(this.messageService.getMessages());
    }
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

  private getNotesByPlusCode(location: Location, notesSubject: Subject<void>) {
    let plusCode: string = this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom());
    this.notes = [];
    this.notes = this.allUserNotes.filter((note) => note.plusCode.startsWith(plusCode));
    notesSubject.next();
  }

  private updateDataForLocation(location: Location, forceSearch: boolean) {
    if (this.placeService.getSelectedPlace().plusCodes.length > 0) {
      this.isPartOfPlace = this.placeService.getSelectedPlace().plusCodes.some(element => element === this.mapService.getMapLocation().plusCode);
    } else {
      if (this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom()) !== this.messageService.getLastSearchedLocation() || forceSearch) {
        // Clear markerLocations
        this.markerLocations.clear()
        // notes from local device
        this.getNotesByPlusCode(this.mapService.getMapLocation(), this.notesSubject);
        // Messages
        this.getMessages(this.mapService.getMapLocation(), forceSearch, false);
        // in the complete event of getMessages
      } else {
        //this.createMarkerLocations();
      }
    }
  }

  public handleMoveEndEvent(event: Location) {
    this.updateDataForLocation(this.mapService.getMapLocation(), false)
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
    let messages: Message[] = [];
    let notes: Note[] = [];
    switch (event.type) {
      case MarkerType.PUBLIC_MESSAGE:
        if (this.mapService.getMapZoom() > 19) {
          messages = this.messageService.getMessages().filter((message) => message.plusCode === event.plusCode);
          this.openMarkerMessageListDialog(messages);
        } else {
          this.openMarkerMessageListDialog(this.messageService.getMessages());
        }

        break;
      case MarkerType.PRIVATE_NOTE:
        if (this.mapService.getMapZoom() > 19) {
          notes = this.notes.filter((note) => note.plusCode === event.plusCode);
          this.openMarkerNoteListDialog(notes);
        } else {
          this.openMarkerNoteListDialog(this.notes);
        }
        break;
      case MarkerType.MULTI:
        if (this.mapService.getMapZoom() > 19) {
          messages = this.messageService.getMessages().filter((message) => message.plusCode === event.plusCode);
          notes = this.notes.filter((note) => note.plusCode === event.plusCode);
          this.openMarkerMultiDialog(messages, notes);
        } else {
          this.openMarkerMultiDialog(this.messageService.getMessages(), this.notes);
        }
        break;
    }
  }

  public handleClickEvent(event: Location) {
    this.mapService.flyTo(event);
  }

  public openMessagDialog(location: Location): void {
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
      userId: ''
    };
    const dialogRef = this.messageDialog.open(MessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, user: this.userService.getUser(), message: message },
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
        this.messageService.createMessage(data.message, this.mapService.getMapLocation(), data.user);
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      }
    });
  }

  public openNoteDialog(location: Location): void {
    let note: Note = {
      latitude: 0,
      longitude: 0,
      plusCode: '',
      note: '',
      markerType: 'note',
      style: '',
    };
    const dialogRef = this.noteDialog.open(NoteComponent, {
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
        this.allUserNotes = [data?.note, ...this.allUserNotes];
        this.notes = [data?.note, ...this.notes];
        this.noteService.saveNotesToStorage(this.allUserNotes);
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      }
    });
  }

  public openUserMessagListDialog(): void {
    this.userService.getUserMessages(this.userService.getUser())
      .subscribe({
        next: (getMessageResponse) => {
          const dialogRef = this.messageListDialog.open(MessagelistComponent, {
            panelClass: 'MessageListDialog',
            closeOnNavigation: true,
            data: { user: this.userService.getUser(), messages: [...getMessageResponse.rows] },
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
            this.getMessages(this.mapService.getMapLocation(), true, false);
          });
        },
        error: (err) => {
          this.messageService.clearMessages();
          this.snackBarRef = this.snackBar.open("You have not written any messages yet", undefined, {
            panelClass: ['snack-warning'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 1000
          });
        },
        complete: () => { }
      });
  }

  public openUserNoteListDialog(): void {
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'NoteListDialog',
      closeOnNavigation: true,
      data: { user: this.userService.getUser(), notes: [...this.noteService.loadNotesFromStorage()] },
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
      this.allUserNotes = [...this.noteService.loadNotesFromStorage()];
      this.getNotesByPlusCode(this.mapService.getMapLocation(), this.notesSubject);
    });
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
      data: { user: this.userService.getUser(), messages: messages },
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
      this.getMessages(this.mapService.getMapLocation(), true, false);
    });
  }

  public openMarkerNoteListDialog(notes: Note[]) {
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: { user: this.userService.getUser(), notes: notes },
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
      this.allUserNotes = [...this.noteService.loadNotesFromStorage()];
      this.getNotesByPlusCode(this.mapService.getMapLocation(), this.notesSubject);
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
        this.userService.saveUser(result);
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
        this.userService.deleteUser(this.userService.getUser())
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) {
                this.userService.clearStorage();
                this.getMessages(this.mapService.getMapLocation(), true, false);
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
              let connect: Connect = {
                id: '',
                userId: this.userService.getUser().id,
                hint: result?.connectHint,
                signature: signature,
                encryptionPublicKey: JSON.stringify(this.userService.getUser().encryptionKeyPair?.publicKey!),
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
    this.notes.forEach((note) => {
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
