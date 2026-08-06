import { Location } from './location';

export interface TripGoLocation {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  stopCode?: string;
  region?: string;
  timezone?: string;
}

export interface TripGoCost {
  amount: number;
  currency: string;
  accuracy?: string;
}

export interface TripGoServiceInfo {
  number?: string;
  direction?: string;
  operator?: string;
  operatorId?: string;
  startPlatform?: string;
  endPlatform?: string;
  stops?: number;
  routeId?: string;
  tripId?: string;
  textColor?: string;
  realTimeStatus?: string;
  ticketWebsiteUrl?: string;
}

export interface TripGoRouteSegment {
  id: string;
  type?: string;
  modeIdentifier?: string;
  modeLabel?: string;
  icon?: string;
  color?: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  availability?: string;
  bicycleAccessible?: boolean;
  from?: TripGoLocation;
  to?: TripGoLocation;
  distanceMeters?: number;
  cost?: TripGoCost;
  service?: TripGoServiceInfo;
  geometry: string[];
}

export interface TripGoRouteOption {
  id: string;
  groupIndex: number;
  frequencyMinutes?: number;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  availability?: string;
  weightedScore?: number;
  calories?: number;
  carbon?: number;
  transfers: number;
  modes: string[];
  cost?: TripGoCost;
  segments: TripGoRouteSegment[];
}

export interface TripGoRoutingResult {
  region?: string;
  query?: {
    departureTime?: string;
    arrivalTime?: string;
    from?: TripGoLocation;
    to?: TripGoLocation;
  };
  routes: TripGoRouteOption[];
  meta: {
    groups: number;
    totalRoutes: number;
    returnedRoutes: number;
  };
}

export interface TripGoRouteRequest {
  from: Pick<Location, 'latitude' | 'longitude'>;
  to: Pick<Location, 'latitude' | 'longitude'>;
  locale: string;
  modes: string[];
}

export interface TripGoRoutesResponse {
  status: number;
  data: TripGoRoutingResult;
  cache: 'hit' | 'miss';
}

export interface TripGoLiveServiceDetails {
  serviceTripId?: string;
  updatedAt: string;
  departureTime?: string;
  arrivalTime?: string;
  scheduledDepartureTime?: string;
  scheduledArrivalTime?: string;
  delaySeconds?: number;
  platform?: string;
  endPlatform?: string;
  direction?: string;
  realTime?: boolean;
  alerts: string[];
}

export interface TripGoServiceDetailsResponse {
  status: number;
  data: TripGoLiveServiceDetails;
  cache: 'hit' | 'miss';
}
