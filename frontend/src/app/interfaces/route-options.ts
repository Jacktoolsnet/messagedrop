export interface RouteOptions {
  car: boolean;
  bicycle: boolean;
  bicyclePublicTransport: boolean;
  bicyclePureMaxKm: number;
  walking: boolean;
  walkingPublicTransport: boolean;
  walkingPureMaxKm: number;
  flights: boolean;
}

export const DEFAULT_ROUTE_OPTIONS: RouteOptions = {
  car: true,
  bicycle: true,
  bicyclePublicTransport: true,
  bicyclePureMaxKm: 8,
  walking: true,
  walkingPublicTransport: true,
  walkingPureMaxKm: 2,
  flights: true
};

export function normalizeRouteOptions(options?: Partial<RouteOptions> | null): RouteOptions {
  return {
    car: options?.car ?? DEFAULT_ROUTE_OPTIONS.car,
    bicycle: options?.bicycle ?? DEFAULT_ROUTE_OPTIONS.bicycle,
    bicyclePublicTransport: options?.bicyclePublicTransport ?? DEFAULT_ROUTE_OPTIONS.bicyclePublicTransport,
    bicyclePureMaxKm: clamp(options?.bicyclePureMaxKm, 3, 15, DEFAULT_ROUTE_OPTIONS.bicyclePureMaxKm),
    walking: options?.walking ?? DEFAULT_ROUTE_OPTIONS.walking,
    walkingPublicTransport: options?.walkingPublicTransport ?? DEFAULT_ROUTE_OPTIONS.walkingPublicTransport,
    walkingPureMaxKm: clamp(options?.walkingPureMaxKm, 1, 3, DEFAULT_ROUTE_OPTIONS.walkingPureMaxKm),
    flights: options?.flights ?? DEFAULT_ROUTE_OPTIONS.flights
  };
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Number(value))) : fallback;
}

export function hasEnabledRouteVariant(options: RouteOptions): boolean {
  return options.car || options.bicycle || options.walking;
}
