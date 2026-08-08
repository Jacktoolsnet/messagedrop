import { Injectable } from '@angular/core';
import { Location } from '../interfaces/location';
import { TripGoRouteCategory, TripGoRouteOption } from '../interfaces/tripgo';

export interface TripGoRoutePointDetails {
  name: string;
  address: string;
}

export interface TripGoRouteSession {
  origin: Location;
  destination: Location;
  originDetails: TripGoRoutePointDetails | null;
  destinationDetails: TripGoRoutePointDetails | null;
  routes: TripGoRouteOption[];
  requestedRouteCategories: TripGoRouteCategory[];
  expandedRouteIds: string[];
}

const SAME_ROUTE_POINT_RADIUS_METERS = 3;

@Injectable({ providedIn: 'root' })
export class TripGoRouteSessionService {
  private session: TripGoRouteSession | null = null;

  save(session: TripGoRouteSession): void {
    this.session = structuredClone(session);
  }

  restore(destination: Location, origin?: Location): TripGoRouteSession | null {
    if (!this.session || !this.isSamePoint(this.session.destination, destination)) return null;
    if (origin && !this.isSamePoint(this.session.origin, origin)) return null;
    return structuredClone(this.session);
  }

  clear(): void {
    this.session = null;
  }

  private isSamePoint(first: Location, second: Location): boolean {
    const toRadians = (value: number) => value * Math.PI / 180;
    const latitudeDelta = toRadians(second.latitude - first.latitude);
    const longitudeDelta = toRadians(second.longitude - first.longitude);
    const firstLatitude = toRadians(first.latitude);
    const secondLatitude = toRadians(second.latitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine)) <= SAME_ROUTE_POINT_RADIUS_METERS;
  }
}
