import { Component, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from './../environments/environment';
import { MapComponent } from './map/map.component';
import { GeolocationService } from './services/geolocation.service';
import { User } from './interfaces/user';
import { Location } from './interfaces/location';
import { UserService } from './services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatButtonModule} from '@angular/material/button';
import { Keypair } from './interfaces/keypair';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MapComponent, MatButtonModule, MatTooltipModule, MatIconModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private title: String = 'frontend';
  private apiUrl: String = environment.apiUrl;
  private user: User = { userId: ''};
  public location: Location = { latitude: 0, longitude: 0, zoom: 18, plusCode: ''};
  private snackBarRef: any;

  constructor(private geolocationService: GeolocationService, private userService: UserService, private snackBar: MatSnackBar) { }

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
          });
        });
      });
    }
  }

  watchPosition() {
    this.geolocationService.watchPosition().subscribe({
      next: (position) => {
        this.location.latitude = position.coords.latitude;
        this.location.longitude = position.coords.longitude;
        this.location.plusCode = this.geolocationService.getPlusCode(position.coords.latitude, position.coords.longitude)
      },
      error: (error) => {
        console.log(error);
        if (error.code == 1) {
          this.snackBarRef = this.snackBar.open(`Location is required for message drop to work correctly. Please authorize.` , 'OK');
        } else {
          this.snackBarRef = this.snackBar.open(error.message , 'OK');
        }
        this.snackBarRef.afterDismissed().subscribe(() => {
          this.watchPosition();
        });
      }
    });
  }

  handleZoomEvent(event: number) {
    this.location.zoom = event;
  }
}
