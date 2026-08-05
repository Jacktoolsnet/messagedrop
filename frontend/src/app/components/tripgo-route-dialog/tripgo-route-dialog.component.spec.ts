import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { GeolocationService } from '../../services/geolocation.service';
import { TripGoService } from '../../services/tripgo.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { TripGoRouteDialogComponent } from './tripgo-route-dialog.component';

describe('TripGoRouteDialogComponent', () => {
  let fixture: ComponentFixture<TripGoRouteDialogComponent>;
  let geolocation: jasmine.SpyObj<GeolocationService>;
  let tripGo: jasmine.SpyObj<TripGoService>;

  beforeEach(async () => {
    geolocation = jasmine.createSpyObj<GeolocationService>('GeolocationService', ['getCurrentPosition', 'getPlusCode']);
    tripGo = jasmine.createSpyObj<TripGoService>('TripGoService', ['calculatePublicTransportRoute']);
    geolocation.getCurrentPosition.and.returnValue(of({
      coords: {
        latitude: 52.52, longitude: 13.405, accuracy: 5,
        altitude: null, altitudeAccuracy: null, heading: null, speed: null,
        toJSON: () => ({})
      },
      timestamp: Date.now(),
      toJSON: () => ({})
    }));
    geolocation.getPlusCode.and.returnValue('9F4MGC9X+XX');
    tripGo.calculatePublicTransportRoute.and.returnValue(of({
      routes: [], meta: { groups: 0, totalRoutes: 0, returnedRoutes: 0 }
    }));

    await TestBed.configureTestingModule({
      imports: [TripGoRouteDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { destination: { latitude: 52.51, longitude: 13.38, plusCode: '' } } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: GeolocationService, useValue: geolocation },
        { provide: TripGoService, useValue: tripGo },
        { provide: TranslocoService, useValue: { getActiveLang: () => 'de' } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } }
      ]
    }).overrideComponent(TripGoRouteDialogComponent, {
      set: { template: '<div></div>' }
    }).compileComponents();

    fixture = TestBed.createComponent(TripGoRouteDialogComponent);
  });

  it('requests a fresh high-accuracy location before calculating routes', () => {
    fixture.detectChanges();

    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000
    });
    expect(tripGo.calculatePublicTransportRoute).toHaveBeenCalledWith(
      jasmine.objectContaining({ latitude: 52.52, longitude: 13.405 }),
      jasmine.objectContaining({ latitude: 52.51, longitude: 13.38 }),
      'de'
    );
    expect(fixture.componentInstance.state()).toBe('ready');
  });

  it('starts another location request when refreshed', () => {
    fixture.detectChanges();
    fixture.componentInstance.calculateWithFreshLocation();

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(tripGo.calculatePublicTransportRoute).toHaveBeenCalledTimes(2);
  });
});
