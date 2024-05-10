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
    MatDialogClose],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  public userReady: boolean = false;
  public locationReady: boolean = false;
  private user: User = { userId: ''};
  public location: Location = { latitude: 0, longitude: 0, zoom: -1, plusCode: ''};
  public mapLocation: Location = { latitude: 0, longitude: 0, zoom: -1, plusCode: ''};
  public userLocation: Location = { latitude: 0, longitude: 0, zoom: 19, plusCode: ''};
  private lastPlusCode: string = ''
  public messages: Message[] = [];
  private snackBarRef: any;

  constructor(
    private mapService: MapService,
    private geolocationService: GeolocationService, 
    private userService: UserService,
    private messageService: MessageService,
    private statisticService: StatisticService, 
    private snackBar: MatSnackBar, 
    public messageDropDialog: MatDialog,
    public messageListDialog: MatDialog) { }

  ngOnInit(): void {
    this.getUser();
    this.watchPosition();
  }

  getUser() {
    this.user = this.userService.getUser();
    if (JSON.stringify(this.user) === '{}') {
      this.userService.createEncryptionKey()
      .then((encryptionKeyPair : Keypair ) => {
        this.user.encryptionKeyPair = encryptionKeyPair;
        this.userService.createSigningKey()
        .then((signingKeyPair : Keypair ) => {
          this.user.signingKeyPair = signingKeyPair;
          this.userService.createUser(this.user.encryptionKeyPair?.publicKey, this.user.signingKeyPair?.publicKey)
          .subscribe(createUserResponse => {
            this.user.userId = createUserResponse.userId;
            this.userService.setUserId(this.user);
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
                this.userService.restoreUser(this.user.userId, this.user.encryptionKeyPair?.publicKey, this.user.signingKeyPair?.publicKey)
                .subscribe(createUserResponse => {
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

  watchPosition() {
    this.geolocationService.watchPosition().subscribe({
      next: (position) => {
        this.userLocation.latitude = position.coords.latitude;
        this.userLocation.longitude = position.coords.longitude;
        this.userLocation.plusCode = this.geolocationService.getPlusCode(position.coords.latitude, position.coords.longitude)
        if (this.mapLocation.zoom === -1) {
          this.mapLocation.latitude = this.userLocation.latitude;
          this.mapLocation.longitude = this.userLocation.longitude;
          this.mapLocation.zoom = this.userLocation.zoom;
          this.mapLocation.plusCode = this.userLocation.plusCode;
        }
        if (this.location.zoom === -1) {
          this.location.latitude = this.userLocation.latitude;
          this.location.longitude = this.userLocation.longitude;
          this.location.zoom = this.userLocation.zoom;
          this.location.plusCode = this.userLocation.plusCode;
        }
        if (this.mapLocation.plusCode === this.userLocation.plusCode) {
          this.mapService.setUserMarker(this.userLocation);
          this.mapService.flyTo(this.userLocation);
        }
        this.locationReady = true;
      },
      error: (error) => {
        if (error.code == 1) {
          this.snackBarRef = this.snackBar.open(`Location is required for message drop to work correctly. Please authorize.` , 'OK');
        } else {
          this.snackBarRef = this.snackBar.open("Position could not be determined. Please try again later." , 'OK');
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
                this.messages.length = 0;
              },
              complete:() => {}
            });
  }

  handleMapEvent(event: Location) {
    console.log('mapEvent');
    this.mapLocation.latitude = event.latitude;
    this.mapLocation.longitude = event.longitude;
    this.mapLocation.zoom = event.zoom;
    this.mapLocation.plusCode = event.plusCode;
    if (this.lastPlusCode != this.mapLocation.plusCode) {
      this.lastPlusCode = this.mapLocation.plusCode;
      console.log('mapEvent search');
      this.getMessages(this.mapLocation);
    }
  }

  handleMarkerClickEvent(event: Location) {
    this.openMarkerMessageListDialog(event);
  }

  openMessagDropDialog(): void {
    this.mapService.flyTo(this.userLocation);
    const dialogRef = this.messageDropDialog.open(DropmessageComponent, {
      panelClass: 'MessageDropDialog',
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth:'90vw',
      hasBackdrop: true      
    });

    dialogRef.afterClosed().subscribe((message: Message) => {
      if (undefined !== message) {
        this.messageService.createPublicMessage(message, this.userLocation, this.user)
            .subscribe({
              next: createMessageResponse => {
                this.snackBarRef = this.snackBar.open(`Message succesfully dropped.`, '', {duration: 1000});
                this.getMessages(this.userLocation);
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
                  data: [...getMessageResponse.rows],
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

}
