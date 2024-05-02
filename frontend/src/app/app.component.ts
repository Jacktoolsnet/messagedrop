import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { environment } from './../environments/environment';
import { MapComponent } from './map/map.component';
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
import { DropmessageComponent } from './dropmessage/dropmessage.component';
import { MessageService } from './services/message.service';
import { MatBadgeModule } from '@angular/material/badge';
import { Message } from './interfaces/message';
import { MessagelistComponent } from './messagelist/messagelist.component';

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
  private title: String = 'frontend';
  private apiUrl: String = environment.apiUrl;
  public userReady: boolean = false;
  public locationReady: boolean = false;
  private user: User = { userId: ''};
  public location: Location = { latitude: 0, longitude: 0, zoom: 19, plusCode: ''};
  private lastPlusCode: string = ''
  private messages: Message[] = [];
  public messageBatchText: string = '0';
  private snackBarRef: any;

  constructor(
    private geolocationService: GeolocationService, 
    private userService: UserService,
    private messageService: MessageService, 
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
      try {
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
      } catch (err) {
        console.log('ttt');
      }
    }
  }

  watchPosition() {
    this.geolocationService.watchPosition().subscribe({
      next: (position) => {
        this.location.latitude = position.coords.latitude;
        this.location.longitude = position.coords.longitude;
        this.location.plusCode = this.geolocationService.getPlusCode(position.coords.latitude, position.coords.longitude)
        this.locationReady = true;
        // Only search if the plusCode chagnes.
        if (this.lastPlusCode != this.location.plusCode) {
          this.getMessages();
          // Save the last plusCode.
          this.lastPlusCode = this.location.plusCode;
        }
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

  getMessages() {
    this.messageService.getByPlusCode(this.location)
            .subscribe({
              next: (getMessageResponse) => {
                if (200 === getMessageResponse.status) {
                  this.messages = [...getMessageResponse.rows];                  
                }
                if (this.messages.length < 100) {
                  this.messageBatchText = `${this.messages.length}`;
                } else {
                  this.messageBatchText = '99+'
                }
              },
              error: (err) => {
                this.messages.length = 0;
                this.messageBatchText = `${this.messages.length}`;
              },
              complete:() => {}
            });
  }

  handleZoomEvent(event: number) {
    if (this.location.zoom !== event) {
      this.location.zoom = event;
      this.getMessages();
    }
  }

  openMessagDropDialog(): void {
    const dialogRef = this.messageDropDialog.open(DropmessageComponent, {
      panelClass: 'MessageDropDialog',
      width: '80%',
      height:  '80%',
      maxWidth: '400px',
      maxHeight: '400px',
      hasBackdrop: true      
    });

    dialogRef.afterClosed().subscribe(message => {
      if (undefined !== message) {
        this.messageService.createPublicMessage(message, this.location, this.user)
            .subscribe(createMessageResponse => {
              if (200 === createMessageResponse.status) {
                this.snackBarRef = this.snackBar.open(`Message succesfully dropped.`, '', {duration: 1000});
                this.getMessages();
              }
            });
      }
    });
  }

  openMessagListDialog(): void {
    if (this.messages.length !== 0) {
      const dialogRef = this.messageListDialog.open(MessagelistComponent, {
        panelClass: 'MessageListDialog',
        data: this.messages,
        width: '95%',
        height:  '95%',
        hasBackdrop: true      
      });
    }
  }
}
