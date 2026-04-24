import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { AirQualityData } from '../../interfaces/air-quality-data';
import { AirQualityTileValue } from '../../interfaces/air-quality-tile-value';
import { Location } from '../../interfaces/location';
import { NominatimService } from '../../services/nominatim.service';
import { OpenMeteoRefreshService } from '../../services/open-meteo-refresh.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { AirQualityComponent } from './air-quality.component';

describe('AirQualityComponent', () => {
  let nominatimResult$: Observable<{ nominatimPlace: { address: { city?: string; country?: string } } }>;
  const location: Location = {
    latitude: 52.52,
    longitude: 13.405,
    plusCode: '9F4MGC2F+H4'
  };

  const airQuality: AirQualityData = {
    latitude: 52.52,
    longitude: 13.405,
    generationtime_ms: 1,
    utc_offset_seconds: 0,
    timezone: 'UTC',
    timezone_abbreviation: 'UTC',
    elevation: 34,
    hourly_units: {
      time: 'iso8601',
      alder_pollen: '',
      birch_pollen: '',
      grass_pollen: '',
      mugwort_pollen: '',
      olive_pollen: '',
      ragweed_pollen: '',
      pm10: 'µg/m³',
      pm2_5: 'µg/m³',
      carbon_monoxide: 'ppm',
      nitrogen_dioxide: 'ppb',
      sulphur_dioxide: 'ppb',
      ozone: 'ppb'
    },
    hourly: {
      time: ['2026-04-23T00:00'],
      alder_pollen: [0],
      birch_pollen: [0],
      grass_pollen: [0],
      mugwort_pollen: [0],
      olive_pollen: [0],
      ragweed_pollen: [0],
      pm10: [0],
      pm2_5: [0],
      carbon_monoxide: [0],
      nitrogen_dioxide: [0],
      sulphur_dioxide: [0],
      ozone: [0]
    }
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
      imports: [AirQualityComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            location,
            airQuality
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
            getAirQualityState: () => undefined,
            refreshAirQuality: jasmine.createSpy('refreshAirQuality')
          }
        },
        { provide: TranslationHelperService, useValue: { t: (key: string) => key } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } }
      ]
    })
    .overrideComponent(AirQualityComponent, {
      set: {
        template: '<div></div>'
      }
    })
    .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AirQualityComponent);
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
    const fixture = TestBed.createComponent(AirQualityComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.locationName$?.subscribe((locationName) => {
      expect(locationName).toBe(location.plusCode);
      done();
    });
  });

  it('should open the detail view for a zero-valued tile when data exists', () => {
    const fixture = TestBed.createComponent(AirQualityComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedDayIndex = 0;
    component.selectedHour = 0;
    component.updateTiles();

    const tile = component.tileValues().find((entry) => entry.key === 'alder_pollen');

    expect(tile).toBeDefined();

    component.onTileClick(tile!);

    expect(component.selectedTile?.key).toBe('alder_pollen');
  });

  it('should keep the detail view closed when no data exists for the selected day', () => {
    const fixture = TestBed.createComponent(AirQualityComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.selectedDayIndex = 1;

    const tile: AirQualityTileValue = {
      key: 'alder_pollen',
      value: 0,
      values: [0],
      time: ['2026-04-23T00:00'],
      label: 'Alder pollen',
      unit: '',
      color: '#000000',
      icon: 'grass',
      description: '',
      levelText: '',
      minMax: { min: 0, max: 0 }
    };

    component.onTileClick(tile);

    expect(component.selectedTile).toBeNull();
  });
});
