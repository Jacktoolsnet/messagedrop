import { Component, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from './../environments/environment';
import { MapComponent } from './map/map.component';
import { GeolocationService } from './services/geolocation.service';
import { User } from './interfaces/user';
import { UserService } from './services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatButtonModule} from '@angular/material/button';

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
  private user: User = {userId: ''};
  public latitude: number = 0;
  public longitude: number = 0;
  public zoom: number = 18;
  private snackBarRef: any;

  constructor(private geolocationService: GeolocationService, private userService: UserService, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    this.getUser();
    this.watchPosition();
  }

  getUser() {
    let userId = this.userService.getUser();
    if (null === userId) {
      this.userService.createUser()
      .subscribe(createUserResponse => {
        this.user.userId = createUserResponse.userId;
        this.userService.setUserId(this.user.userId);
      });
    }
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
