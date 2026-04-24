import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { Location } from '../../interfaces/location';
import { Weather } from '../../interfaces/weather';
import { NominatimService } from '../../services/nominatim.service';
import { OpenMeteoRefreshService } from '../../services/open-meteo-refresh.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { WeatherComponent } from './weather.component';
import { WeatherTile } from './weather-tile.interface';

describe('WeatherComponent', () => {
  let nominatimResult$: Observable<{ nominatimPlace: { address: { city?: string; country?: string } } }>;
  const location: Location = {
    latitude: 52.52,
    longitude: 13.405,
    plusCode: '9F4MGC2F+H4'
  };

  const weather: Weather = {
    current: {
      temperature: 0,
      windspeed: 5,
      weatherCode: 0,
      time: '2026-04-23T00:00'
    },
    daily: [
      {
        date: '2026-04-23',
        sunrise: '2026-04-23T06:00',
        sunset: '2026-04-23T20:00',
        temperatureMax: 4,
        temperatureMin: -2
      }
    ],
    hourly: [
      {
        time: '2026-04-23T00:00',
        temperature: 0,
        precipitationProbability: 0,
        precipitation: 0,
        uvIndex: 0,
        pressure: 1014,
        wind: 5
      }
    ]
  };

  beforeEach(async () => {
    nominatimResult$ = of({
      nominatimPlace: {
        address: {
          city: 'Berlin',
          country: 'Germany'
        }
      }
    });

    await TestBed.configureTestingModule({
      imports: [WeatherComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            location,
            weather
          }
        },
        {
          provide: NominatimService,
          useValue: {
            getNominatimPlaceByLocation: () => nominatimResult$
          }
        },
        {
          provide: OpenMeteoRefreshService,
          useValue: {
            getWeatherState: () => undefined,
            refreshWeather: jasmine.createSpy('refreshWeather')
          }
        },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } }
      ]
    })
    .overrideComponent(WeatherComponent, {
      set: {
        template: '<div></div>'
      }
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(WeatherComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should use the plus code when Nominatim returns no place name', (done) => {
    nominatimResult$ = of({
      nominatimPlace: {
        address: {}
      }
    });
    const fixture = TestBed.createComponent(WeatherComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.locationName$?.subscribe((locationName) => {
      expect(locationName).toBe(location.plusCode);
      done();
    });
  });

  it('should open the detail view for a temperature tile with value 0', () => {
    const fixture = TestBed.createComponent(WeatherComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedDayIndex = 0;
    component.selectedHour = 0;
    component.onDayChange(0);

    const temperatureTile = component.tiles().find((tile) => tile.type === 'temperature');

    expect(temperatureTile).toBeDefined();

    component.onTileClick(temperatureTile!);

    expect(component.selectedTile?.type).toBe('temperature');
  });

  it('should keep the detail view closed when no data is available for the selected time', () => {
    const fixture = TestBed.createComponent(WeatherComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedDayIndex = 0;
    component.selectedHour = 12;

    const tile: WeatherTile = {
      type: 'temperature',
      label: 'Temperature',
      icon: 'thermostat',
      value: '0 °C',
      levelText: '',
      color: '#000000',
      minMax: { min: 0, max: 0 }
    };

    component.onTileClick(tile);

    expect(component.selectedTile).toBeNull();
  });
});
