import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { DropmessageComponent } from './components/dropmessage/dropmessage.component';
import { MessageService } from './services/message.service';
import { StatisticService } from './services/statistic.service';
import { MatBadgeModule } from '@angular/material/badge';
import { Message } from './interfaces/message';
import { MessagelistComponent } from './components/messagelist/messagelist.component';
import { MapService } from './services/map.service';
import { ShortNumberPipe } from './pipes/short-number.pipe';
import { ProfileComponent } from './components/user/profile/profile.component';

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
  private snackBarRef: any;
  public isUserLocation: boolean = false;

  constructor(
    public mapService: MapService,
    private geolocationService: GeolocationService, 
    private userService: UserService,
    private messageService: MessageService,
    private statisticService: StatisticService, 
    private snackBar: MatSnackBar, 
    public messageDropDialog: MatDialog,
    public messageListDialog: MatDialog,
    public userProfileDialog: MatDialog) { }

  ngOnInit(): void {
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

  getMessages(location: Location) {
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

  handleMoveEndEvent(event: Location) {
    this.getMessages(this.mapService.getMapLocation());
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

  openMessagDropDialog(location: Location): void {
    const dialogRef = this.messageDropDialog.open(DropmessageComponent, {
      panelClass: 'messageDropDialog',
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth:'90vw',
      hasBackdrop: true      
    });

    dialogRef.afterClosed().subscribe((message: Message) => {
      if (undefined !== message) {
        this.messageService.createPublicMessage(message, this.mapService.getMapLocation(), this.user)
            .subscribe({
              next: createMessageResponse => {
                this.snackBarRef = this.snackBar.open(`Message succesfully dropped.`, '', {duration: 1000});
                this.getMessages(this.mapService.getMapLocation());
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

  openMessagListDialog(): void {
    if (this.messages.length !== 0) {
      const dialogRef = this.messageListDialog.open(MessagelistComponent, {
        panelClass: 'MessageListDialog',
        data: this.messages,
        width: 'auto',
        height: 'auto',
        maxHeight: '90vh',
        maxWidth:'90vw',
        hasBackdrop: true      
      });
    }
  }

  openMarkerMessageListDialog(location: Location) {
    this.messageService.getByPlusForMarker(location)
            .subscribe({
              next: (getMessageResponse) => {
                const dialogRef = this.messageListDialog.open(MessagelistComponent, {
                  panelClass: 'MessageListDialog',
                  data: {user: this.user, messages: [...getMessageResponse.rows]},
                  width: 'auto',
                  height: 'auto',
                  maxHeight: '90vh',
                  maxWidth:'90vw',
                  hasBackdrop: true      
                });
              },
              error: (err) => {},
              complete:() => {}
            });
  }

  editUserProfile() {
    const dialogRef = this.userProfileDialog.open(ProfileComponent, {
      data: {user: this.user},
      hasBackdrop: true 
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userService.saveUser(result);
      }
    });
  }

}
