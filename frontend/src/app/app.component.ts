import { Component, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from './../environments/environment';
import { MapComponent } from './map/map.component';
import { GeolocationService } from './services/geolocation.service';
import { UserService } from './services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { User } from './interfaces/user';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MapComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private title: String = 'frontend';
  private apiUrl: String = environment.apiUrl;
  private user: User = {userId: ''};
  public latitude: number = 0;
  public longitude: number = 0;
  public zoom: number = 18;
  private snackBarRef: any;

  constructor(private geolocationService: GeolocationService, private userService: UserService, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.createUser();
    this.watchPosition();
  }

  createUser() {
    this.userService.createUser()
    .subscribe(createUserResponse => this.user = {
      userId: createUserResponse.userId
    });
  }

  watchPosition() {
    this.geolocationService.watchPosition().subscribe({
      next: (position) => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
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
    this.zoom = event;
  }
}
