import { Component, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from './../environments/environment';
import { MapComponent } from './map/map.component';
import { GeolocationService } from './services/geolocation.service';

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
  public latitude: number = 0;
  public longitude: number = 0;

  constructor(private geolocationService: GeolocationService) { }

  ngOnInit(): void {
    this.getGeoLocation();
  }

  getGeoLocation() {
    this.geolocationService.getCurrentPosition().subscribe({
      next: (position) => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
      },
      error: (error) => {
        console.error('Error getting geolocation:', error);
      },
    });
  }
}
