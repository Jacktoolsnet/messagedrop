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
import { MessagelistComponent } from './components/messagelist/messagelist.component';
import { MapService } from './services/map.service';
import { ShortNumberPipe } from './pipes/short-number.pipe';
import { ProfileComponent } from './components/user/profile/profile.component';
import { MessageMode } from './interfaces/message-mode';

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
  public user!: User;
  public messages: Message[] = [];
  public myHistory: string[] = [];
  private snackBarRef: any;
  public isUserLocation: boolean = false;
  public messageMode: typeof MessageMode = MessageMode;
  private lastSearchedLocation: string = '';

  constructor(
    public mapService: MapService,
    private geolocationService: GeolocationService, 
    private userService: UserService,
    private messageService: MessageService,
    private statisticService: StatisticService, 
    private snackBar: MatSnackBar, 
    public messageDialog: MatDialog,
    public messageListDialog: MatDialog,
    public userProfileDialog: MatDialog,
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
    this.loadUser();
  }

  setIsUserLocation(): void {
    if (this.user.location.plusCode === this.mapService.getMapLocation().plusCode) {
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
        this.user.encryptionKeyPair = encryptionKeyPair;
        this.userService.createSigningKey()
        .then((signingKeyPair : Keypair ) => {
          this.user.signingKeyPair = signingKeyPair;
          this.userService.createUser(this.user.encryptionKeyPair?.publicKey, this.user.signingKeyPair?.publicKey)
          .subscribe(createUserResponse => {
            this.user.id = createUserResponse.userId;
            this.userService.saveUser(this.user);
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
                this.userService.restoreUser(this.user.id, this.user.encryptionKeyPair?.publicKey, this.user.signingKeyPair?.publicKey)
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
    this.mapService.flyTo(this.user.location);
  }

  watchPosition() {
    this.geolocationService.watchPosition().subscribe({
      next: (position) => {
        this.user.location.latitude = position.coords.latitude;
        this.user.location.longitude = position.coords.longitude;
        this.user.location.plusCode = this.geolocationService.getPlusCode(position.coords.latitude, position.coords.longitude)
        //this.user.location.zoom = this.mapService.getMapZoom();
        this.userService.saveUser(this.user);
        this.locationReady = true;
        this.mapService.setUserMarker(this.user.location);
        if (this.isUserLocation) {
          this.mapService.flyTo(this.user.location);
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
    if (this.geolocationService.getPlusCodeBasedOnMapZoom(location) !== this.lastSearchedLocation || forceSearch) {
      this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(location);
      this.messageService.getByPlusCode(location)
              .subscribe({
                next: (getMessageResponse) => {
                  this.messages = [...getMessageResponse.rows];
                },
                error: (err) => {
                  this.messages = [];
                  this.snackBarRef = this.snackBar.open("No message found", undefined , {
                    panelClass: ['snack-warning'],
                    horizontalPosition: 'center',
                    verticalPosition: 'top',
                    duration: 1000
                  });
                },
                complete:() => {}
              });
    } 
  }

  handleMoveEndEvent(event: Location) {
    this.getMessages(this.mapService.getMapLocation(), false);
    this.setIsUserLocation()
    this.mapService.drawSearchRectange(event);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.setCircleMarker(event);
    this.mapService.setDrawCircleMarker(false);
  }

  handleMarkerClickEvent(event: Location) {
    this.openMarkerMessageListDialog(event);
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
      panelClass: 'messageDialog',
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
                this.getMessages(this.mapService.getMapLocation(), true);
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

  openUserMessagListDialog(): void {
    this.userService.getUserMessages(this.user)
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

  openMarkerMessageListDialog(location: Location) {
    this.messageService.getByPlusForMarker(location)
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
                  this.myHistory.push("messageList");
                  window.history.replaceState(this.myHistory, '', '');
                });

                dialogRef.afterClosed().subscribe((data: any) => {
                  this.getMessages(this.mapService.getMapLocation(), true);
                });
              },
              error: (err) => {},
              complete:() => {}
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

}
