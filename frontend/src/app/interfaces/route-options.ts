export interface RouteOptions {
  car: boolean;
  bicycle: boolean;
  walking: boolean;
  flights: boolean;
}

export const DEFAULT_ROUTE_OPTIONS: RouteOptions = {
  car: true,
  bicycle: true,
  walking: true,
  flights: true
};

export function normalizeRouteOptions(options?: Partial<RouteOptions> | null): RouteOptions {
  return {
    car: options?.car ?? DEFAULT_ROUTE_OPTIONS.car,
    bicycle: options?.bicycle ?? DEFAULT_ROUTE_OPTIONS.bicycle,
    walking: options?.walking ?? DEFAULT_ROUTE_OPTIONS.walking,
    flights: options?.flights ?? DEFAULT_ROUTE_OPTIONS.flights
  };
}

export function hasEnabledRouteVariant(options: RouteOptions): boolean {
  return options.car || options.bicycle || options.walking;
}
