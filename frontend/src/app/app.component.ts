import { Component, OnInit } from '@angular/core';
import { CommonModule, PlatformLocation } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './components/map/map.component';
import { GeolocationService } from './services/geolocation.service';
import { User } from './interfaces/user';
import { Location } from './interfaces/location';
import { UserService } from './services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { Keypair } from './interfaces/keypair';
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
import { MessageMode } from './interfaces/message-mode';
import { DeleteUserComponent } from './components/user/delete-user/delete-user.component';
import { NoteComponent } from './components/note/note.component';
import { NoteService } from './services/note.service';
import { NotelistComponent } from './components/notelist/notelist.component';
import { MarkerLocation } from './interfaces/marker-location';
import { MarkerType } from './interfaces/marker-type';
import { MultiMarkerComponent } from './components/map/multi-marker/multi-marker.component';

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
  public userReady: boolean = false;
  public locationReady: boolean = false;
  public user!: User|undefined;
  public messages: Message[] = [];
  public myHistory: string[] = [];
  public notes: Note[] = [];
  public allUserNotes: Note[] = [];
  public markerLocations: Map<string, MarkerLocation> = new Map<string, MarkerLocation>();
  private snackBarRef: any;
  public isUserLocation: boolean = false;
  public messageMode: typeof MessageMode = MessageMode;
  public lastSearchedLocation: string = '';

  constructor(
    public mapService: MapService,
    private geolocationService: GeolocationService, 
    private userService: UserService,
    private messageService: MessageService,
    private noteService: NoteService,
    private statisticService: StatisticService, 
    private snackBar: MatSnackBar, 
    public messageDialog: MatDialog,
    public noteDialog: MatDialog,
    public messageListDialog: MatDialog,
    public userProfileDialog: MatDialog,
    public dialog: MatDialog,
    private platformLocation: PlatformLocation) { }

  ngOnInit(): void {
    this.platformLocation.onPopState((event) => {
      if (this.myHistory.length > 0) {
        this.myHistory.pop();
        window.history.pushState(this.myHistory, '', '');
      } else {
        //No "history" - let them exit or keep them in the app.
      }
    });
    window.history.pushState(this.myHistory, '', '');
    this.allUserNotes = [...this.noteService.loadNotesFromStorage()];
    this.loadUser();
  }

  setIsUserLocation(): void {
    if (this.user?.location.plusCode === this.mapService.getMapLocation().plusCode) {
      this.isUserLocation = true;
    } else {
      this.isUserLocation = false;
    }
  }

  loadUser() {
    this.user = this.userService.loadUser();
    this.goToUserLocation();
    if (this.user.id === 'undefined') {
      this.userService.createEncryptionKey()
      .then((encryptionKeyPair : Keypair ) => {
        this.user!.encryptionKeyPair = encryptionKeyPair;
        this.userService.createSigningKey()
        .then((signingKeyPair : Keypair ) => {
          this.user!.signingKeyPair = signingKeyPair;
          this.userService.createUser(this.user!.encryptionKeyPair?.publicKey, this.user!.signingKeyPair?.publicKey)
          .subscribe(createUserResponse => {
            this.user!.id = createUserResponse.userId;
            this.userService.saveUser(this.user!);
            this.userReady = true;
          });
        });
      });
    } else {
      // Check if the user exist. It could be that the database was deleted.  
      this.userService.checkUserById(this.user)
          .subscribe({
            next: (data) => {
              this.userReady = true;
            },
            error: (err) => {
              // Create the user when it does not exist in the database.
              if (err.status === 404) {
                this.userService.restoreUser(this.user!.id, this.user!.encryptionKeyPair?.publicKey, this.user!.signingKeyPair?.publicKey)
                .subscribe(createUserResponse => {
                  console.log(createUserResponse)
                  this.userReady = true;
                });
              }
            },
            complete:() => {
              this.userReady = true;
            }
          });
    }
    // Count
    this.statisticService.countVisitor()
          .subscribe({
            next: (data) => {},
            error: (err) => {},
            complete:() => {}
          });
  }

  startWatchingPosition() {
    this.isUserLocation = true;
    this.watchPosition();
  }

  goToUserLocation() {
    this.mapService.flyTo(this.user!.location);
  }

  watchPosition() {
    this.geolocationService.watchPosition().subscribe({
      next: (position) => {
        this.user!.location.latitude = position.coords.latitude;
        this.user!.location.longitude = position.coords.longitude;
        this.user!.location.plusCode = this.geolocationService.getPlusCode(position.coords.latitude, position.coords.longitude)
        if (undefined  == this.mapService.getMapZoom()) {
          this.user!.location.zoom = 17;
        }        
        this.userService.saveUser(this.user!);
        this.locationReady = true;
        this.mapService.setUserMarker(this.user!.location);
        if (this.isUserLocation) {
          this.mapService.flyTo(this.user!.location);
        }
      },
      error: (error) => {
        if (error.code == 1) {
          this.snackBarRef = this.snackBar.open(`Please authorize location.` , 'OK',  {
            panelClass: ['snack-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 1000
          });
        } else {
          this.snackBarRef = this.snackBar.open("Position could not be determined. Please try again later." , 'OK',  {
            panelClass: ['snack-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 1000
          });
        }
        this.locationReady = false;
        this.snackBarRef.afterDismissed().subscribe(() => {
          this.watchPosition();
        });
      }
    });
  }

  getMessages(location: Location, forceSearch: boolean) {
    this.messageService.getByPlusCode(location)
            .subscribe({
              next: (getMessageResponse) => {
                this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(location);                
                this.messages = [...getMessageResponse.rows];
                // At the moment build the marekrLocation map here:
                this.createMarkerLocations()                
              },
              error: (err) => {
                this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(location);                
                this.messages = [];
                // At the moment build the marekrLocation map here:
                this.createMarkerLocations()
                this.snackBarRef = this.snackBar.open("No message found", undefined , {
                  panelClass: ['snack-warning'],
                  horizontalPosition: 'center',
                  verticalPosition: 'top',
                  duration: 1000
                });
              },
              complete:() => {        
                // Is excecutet before the result is here.
                // In the future for example get private or bussiness messages and build the marekrLocation map there.
              }
            });
  }

  getNotesByPlusCode(location: Location, forceSearch: boolean) {
    let plusCode: string = this.geolocationService.getPlusCodeBasedOnMapZoom(location);   
    this.notes = [];
    this.notes = this.allUserNotes.filter((note) => note.plusCode.startsWith(plusCode));
  }

  updateDataForLocation(location: Location, forceSearch: boolean) {
    if (this.geolocationService.getPlusCodeBasedOnMapZoom(location) !== this.lastSearchedLocation || forceSearch) {      
      // 0. Clear markerLocations
      this.markerLocations.clear()      
      // 1. notes from local device
      this.getNotesByPlusCode(this.mapService.getMapLocation(), false);
      // 2. Messages
      this.getMessages(this.mapService.getMapLocation(), false);
      // 3. in the complete event of getMessages
    } else {
      this.createMarkerLocations();
    }
  }

  handleMoveEndEvent(event: Location) {
    this.updateDataForLocation(this.mapService.getMapLocation(), false)
    this.setIsUserLocation()
    this.mapService.drawSearchRectange(event);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.setCircleMarker(event);
    this.mapService.setDrawCircleMarker(false);
  }

  handleMarkerClickEvent(event: any) {
    this.mapService.flyTo({
      latitude: event.latitude,
      longitude: event.longitude,
      zoom: this.mapService.getMapZoom(),
      plusCode: event.plusCode
    });
    switch (event.type) {
      case MarkerType.PUBLIC_MESSAGE:
        var messages: Message[] = this.messages.filter((message) => message.plusCode === event.plusCode);
        this.openMarkerMessageListDialog(messages);
        break;
      case MarkerType.PRIVATE_NOTE:
        var notes: Note[] = this.notes.filter((note) => note.plusCode === event.plusCode);
        this.openMarkerNoteListDialog(notes);
        break; 
      case MarkerType.MULTI:
        this.openMarkerMultiDialog(this.messages, this.notes);
      break;
    }
  }

  handleClickEvent(event: Location) {
    this.mapService.flyTo(event);
  }

  openMessagDialog(location: Location): void {
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
      comments: 0,
      status: 'enabled',
      userId: ''};
    const dialogRef = this.messageDialog.open(MessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {mode: this.messageMode.ADD_PUBLIC_MESSAGE, user: this.user, message: message},
      width: '90vw',
      minWidth: '20vw',
      maxWidth:'90vw',
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
        this.messageService.createMessage(data.message, this.mapService.getMapLocation(), data.user)
            .subscribe({
              next: createMessageResponse => {
                this.snackBarRef = this.snackBar.open(`Message succesfully dropped.`, '', {duration: 1000});
                this.updateDataForLocation(this.mapService.getMapLocation(), true);
                this.statisticService.countMessage()
                .subscribe({
                  next: (data) => {},
                  error: (err) => {},
                  complete:() => {}
                });
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {}
            });          
      }
    });
  }

  openNoteDialog(location: Location): void {
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
      data: {mode: this.messageMode.ADD_NOTE, note: note},
      width: '90vw',
      minWidth: '20vw',
      maxWidth:'90vw',
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
        this.allUserNotes.push(data.note);
        this.notes.push(data.note);
        this.noteService.saveNotesToStorage(this.allUserNotes);
        this.updateDataForLocation(this.mapService.getMapLocation(), true);
      }
    });
  }

  openUserMessagListDialog(): void {
    this.userService.getUserMessages(this.user!)
            .subscribe({
              next: (getMessageResponse) => {
                const dialogRef = this.messageListDialog.open(MessagelistComponent, {
                  panelClass: 'MessageListDialog',
                  closeOnNavigation: true,
                  data: {user: this.user, messages: [...getMessageResponse.rows]},
                  width: 'auto',
                  minWidth: '60vw',
                  maxWidth:'90vw',
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
                  this.getMessages(this.mapService.getMapLocation(), true);
                });
              },
              error: (err) => {
                this.messages = [];
                this.snackBarRef = this.snackBar.open("You have not written any messages yet", undefined , {
                  panelClass: ['snack-warning'],
                  horizontalPosition: 'center',
                  verticalPosition: 'top',
                  duration: 1000
                });
              },
              complete:() => {}
            });
  }

  openUserNoteListDialog(): void {
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: {user: this.user, notes: [...this.noteService.loadNotesFromStorage()]},
      width: 'auto',
      minWidth: '60vw',
      maxWidth:'90vw',
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

  openMarkerMultiDialog(messages: Message[], notes: Note[]) {
    const dialogRef = this.dialog.open(MultiMarkerComponent, {
      data: {messages: messages, notes: notes},
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

  openMarkerMessageListDialog(messages: Message[]) {
    const dialogRef = this.messageListDialog.open(MessagelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: {user: this.user, messages: messages},
      width: 'auto',
      minWidth: '60vw',
      maxWidth:'90vw',
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
      this.getMessages(this.mapService.getMapLocation(), true);
    });
  }

  openMarkerNoteListDialog(notes: Note[]){
    const dialogRef = this.messageListDialog.open(NotelistComponent, {
      panelClass: 'MessageListDialog',
      closeOnNavigation: true,
      data: {user: this.user, notes: notes},
      width: 'auto',
      minWidth: '60vw',
      maxWidth:'90vw',
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

  editUserProfile() {
    const dialogRef = this.userProfileDialog.open(ProfileComponent, {
      data: {user: this.user},
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

  deleteUser() {
    const dialogRef = this.dialog.open(DeleteUserComponent, {
      closeOnNavigation: true,
      hasBackdrop: true 
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.deleteUser(this.user!)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    this.noteService.deleteNotesFromStorage();
                    this.user = this.userService.deleteUserFromStorage();     
                    this.userReady = false;
                    this.getMessages(this.mapService.getMapLocation(), true);               
                  }
                },
                error: (err) => {
                  this.snackBarRef = this.snackBar.open("Oops, something went wrong. Please try again later.", undefined , {
                    panelClass: ['snack-warning'],
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                    duration: 1000
                  });
                },
                complete:() => {}
              });
      }
    });
  }

  private createMarkerLocations() {
    let key: string = "";
    this.markerLocations.clear();
    let center: number[] = [];
    // Process messages
    this.messages.forEach((message) => {
      let location = {
        latitude: message.latitude,
        longitude: message.longitude,
        zoom: this.mapService.getMapZoom(),
        plusCode: message.plusCode
      };
      key = this.createMarkerKey(location);
      if (this.mapService.getMapZoom() > 16) {
        center = [message.latitude, message.longitude]        
      } else {
        center = this.mapService.getSearchRectangeCenter(location);
      }
      if (!this.markerLocations.has(key)){
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
      let location = {
        latitude: note.latitude,
        longitude: note.longitude,
        zoom: this.mapService.getMapZoom(),
        plusCode: note.plusCode
      };
      key = this.createMarkerKey(location);
      if (this.mapService.getMapZoom() > 16) {
        center = [note.latitude, note.longitude]        
      } else {
        center = this.mapService.getSearchRectangeCenter(location);
      }
      if (this.markerLocations.has(key)){        
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
  }

  private createMarkerKey(location: Location): string {
    if (this.mapService.getMapZoom() > 16) {
      return location.plusCode;
    } else {
      return this.geolocationService.getPlusCodeBasedOnMapZoom(location);
    }
  }

}
