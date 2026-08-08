import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { TripGoRouteOption } from '../../interfaces/tripgo';
import { GeolocationService } from '../../services/geolocation.service';
import { NominatimService } from '../../services/nominatim.service';
import { TripGoService } from '../../services/tripgo.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { TripGoRouteDialogComponent } from './tripgo-route-dialog.component';
import { TripGoRoutePointDialogComponent } from './tripgo-route-point-dialog.component';

describe('TripGoRouteDialogComponent', () => {
  let fixture: ComponentFixture<TripGoRouteDialogComponent>;
  let geolocation: jasmine.SpyObj<GeolocationService>;
  let nominatim: jasmine.SpyObj<NominatimService>;
  let tripGo: jasmine.SpyObj<TripGoService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    geolocation = jasmine.createSpyObj<GeolocationService>('GeolocationService', ['getCurrentPosition', 'getPlusCode']);
    nominatim = jasmine.createSpyObj<NominatimService>('NominatimService', [
      'getNominatimPlaceByLocation', 'getFormattedAddress', 'getFormattedStreet'
    ]);
    tripGo = jasmine.createSpyObj<TripGoService>('TripGoService', ['calculateRoute']);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);
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
    nominatim.getNominatimPlaceByLocation.and.returnValue(of({
      status: 200,
      nominatimPlace: {
        place_id: 1,
        licence: '',
        osm_type: 'node',
        osm_id: 1,
        lat: 52.52,
        lon: 13.405,
        class: 'place',
        type: 'city',
        place_rank: 1,
        importance: 1,
        addresstype: 'city',
        name: 'Berlin',
        display_name: 'Berlin, Deutschland',
        address: { city: 'Berlin', country: 'Deutschland' },
        boundingbox: ['0', '0', '0', '0']
      }
    }));
    nominatim.getFormattedAddress.and.returnValue('Berlin, Deutschland');
    nominatim.getFormattedStreet.and.returnValue('');
    tripGo.calculateRoute.and.returnValue(of({
      routes: [], meta: { groups: 0, totalRoutes: 0, returnedRoutes: 0 }
    }));

    await TestBed.configureTestingModule({
      imports: [TripGoRouteDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { destination: { latitude: 52.515, longitude: 13.395, plusCode: '' } } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MatDialog, useValue: dialog },
        { provide: GeolocationService, useValue: geolocation },
        { provide: NominatimService, useValue: nominatim },
        { provide: TripGoService, useValue: tripGo },
        { provide: TranslocoService, useValue: { getActiveLang: () => 'de' } },
        { provide: HelpDialogService, useValue: { open: jasmine.createSpy('open') } }
      ]
    }).overrideComponent(TripGoRouteDialogComponent, {
      set: { template: '<div></div>' }
    }).compileComponents();

    fixture = TestBed.createComponent(TripGoRouteDialogComponent);
  });

  it('prepares a fresh high-accuracy origin without calculating routes automatically', () => {
    fixture.detectChanges();

    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000
    });
    expect(tripGo.calculateRoute).not.toHaveBeenCalled();
    expect(fixture.componentInstance.state()).toBe('idle');
    expect(fixture.componentInstance.originDetails()?.name).toBe('Berlin');
  });

  it('calculates routes only after the explicit action', () => {
    fixture.detectChanges();
    fixture.componentInstance.calculateWithFreshLocation();

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(tripGo.calculateRoute).toHaveBeenCalledTimes(4);
    expect(tripGo.calculateRoute.calls.allArgs().some((args) =>
      args[0].latitude === 52.52
      && args[1].latitude === 52.515
      && args[2] === 'de'
      && args[3].join(',') === 'me_car')).toBeTrue();
    expect(tripGo.calculateRoute.calls.allArgs().some((args) =>
      args[3].join(',') === 'me_mic_bic')).toBeTrue();
    expect(tripGo.calculateRoute.calls.allArgs().some((args) =>
      args[3].join(',') === 'wa_wal')).toBeTrue();
    expect(tripGo.calculateRoute.calls.allArgs().some((args) => args[3].includes('in_air'))).toBeFalse();
    expect(fixture.componentInstance.state()).toBe('ready');
  });

  it('does not request a route when the destination has already been reached', () => {
    fixture.componentInstance.destination.set({
      latitude: 52.52,
      longitude: 13.405,
      plusCode: '9F4MGC9X+XX'
    });

    fixture.detectChanges();
    fixture.componentInstance.calculateWithFreshLocation();

    expect(fixture.componentInstance.state()).toBe('arrived');
    expect(fixture.componentInstance.routes()).toEqual([]);
    expect(tripGo.calculateRoute).not.toHaveBeenCalled();
  });

  it('requests a flight alternative only for a long-distance journey', () => {
    fixture.componentInstance.destination.set({
      latitude: 48.137, longitude: 11.575, plusCode: '8FWH4HPC+R2'
    });

    fixture.detectChanges();
    fixture.componentInstance.calculateWithFreshLocation();

    expect(tripGo.calculateRoute.calls.allArgs().some((args) =>
      args[3].join(',') === 'in_air,pt_pub')).toBeTrue();
    expect(tripGo.calculateRoute.calls.allArgs().some((args) =>
      args[3].join(',') === 'me_mic_bic,pt_pub')).toBeTrue();
    expect(tripGo.calculateRoute.calls.allArgs().some((args) =>
      args[3].join(',') === 'wa_wal,pt_pub')).toBeTrue();
    expect(tripGo.calculateRoute.calls.allArgs().some((args) =>
      args[3].join(',') === 'me_mic_bic' || args[3].join(',') === 'wa_wal')).toBeFalse();
  });

  it('waits for the explicit action after selecting another destination', () => {
    fixture.detectChanges();
    const destination = { latitude: 52.16, longitude: 10.53, plusCode: '9F4G5G6J+XX' };
    dialog.open.and.returnValue({ afterClosed: () => of(destination) } as MatDialogRef<unknown>);

    fixture.componentInstance.editRoutePoint('destination');

    expect(fixture.componentInstance.destination()).toEqual(destination);
    expect(tripGo.calculateRoute).not.toHaveBeenCalled();
    expect(fixture.componentInstance.state()).toBe('idle');
  });

  it('opens the point detail dialog for a selected map marker', () => {
    const route = {
      id: 'route-1', groupIndex: 0, departureTime: '2026-08-06T08:00:00Z',
      arrivalTime: '2026-08-06T08:10:00Z', durationSeconds: 600, transfers: 0, modes: [],
      segments: [{ id: 'walk', geometry: [], from: { name: 'Start' }, to: { name: 'Ziel' } }]
    };
    fixture.componentInstance.selectedRoute.set(route);

    fixture.componentInstance.showRoutePointDetails({ kind: 'segment', segmentIndex: 0 });

    expect(dialog.open).toHaveBeenCalledWith(TripGoRoutePointDialogComponent, jasmine.objectContaining({
      data: { kind: 'segment', segmentIndex: 0, route }
    }));
  });

  it('switches between calculated routes in the map view', () => {
    const routes: TripGoRouteOption[] = ['car-transit', 'walk-transit'].map((category, index) => ({
      id: `route-${index}`, category: category as TripGoRouteOption['category'], groupIndex: index,
      departureTime: '2026-08-06T08:00:00Z', arrivalTime: '2026-08-06T08:10:00Z',
      durationSeconds: 600, transfers: 0, modes: [], segments: []
    }));
    fixture.componentInstance.routes.set(routes);
    fixture.componentInstance.selectedRoute.set(routes[0]);

    expect(fixture.componentInstance.hasPreviousRoute()).toBeFalse();
    expect(fixture.componentInstance.hasNextRoute()).toBeTrue();

    fixture.componentInstance.showNextRoute();

    expect(fixture.componentInstance.selectedRoute()).toBe(routes[1]);
    expect(fixture.componentInstance.hasPreviousRoute()).toBeTrue();
    expect(fixture.componentInstance.hasNextRoute()).toBeFalse();

    fixture.componentInstance.showPreviousRoute();
    expect(fixture.componentInstance.selectedRoute()).toBe(routes[0]);
  });
});
