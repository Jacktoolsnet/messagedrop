export type ViatorSortDirection = 'ASCENDING' | 'DESCENDING';

export type ViatorProductSearchSort =
  | 'DEFAULT'
  | 'PRICE'
  | 'TRAVELER_RATING'
  | 'ITINERARY_DURATION'
  | 'DATE_ADDED';

export type ViatorFreetextProductSort =
  | 'DEFAULT'
  | 'PRICE'
  | 'REVIEW_AVG_RATING'
  | 'ITINERARY_DURATION'
  | 'DATE_ADDED';

export type ViatorSearchType = 'ATTRACTIONS' | 'DESTINATIONS' | 'PRODUCTS';

export type ExperienceProvider = 'viator';

export type ExperienceSortOption = 'relevance' | 'price_low' | 'price_high';

export interface ViatorRangeNumber {
  from?: number;
  to?: number;
}

export interface ViatorRangeDate {
  from?: string;
  to?: string;
}

export interface ViatorProductSearchFiltering {
  destination?: string;
  tags?: number[];
  flags?: string[];
  confirmationType?: string;
  rating?: ViatorRangeNumber;
  durationInMinutes?: ViatorRangeNumber;
  includeAutomaticTranslations?: boolean;
  attractionId?: number;
  lowestPrice?: number;
  highestPrice?: number;
  startDate?: string;
  endDate?: string;
}

export interface ViatorProductSearchSorting {
  sort?: ViatorProductSearchSort;
  order?: ViatorSortDirection;
}

export interface ViatorProductSearchPagination {
  start?: number;
  count?: number;
}

export interface ViatorProductSearchRequest {
  filtering: ViatorProductSearchFiltering;
  sorting?: ViatorProductSearchSorting;
  pagination?: ViatorProductSearchPagination;
  currency: string;
}

export interface ExperienceSearchForm {
  term: import('@angular/forms').FormControl<string>;
  startDate: import('@angular/forms').FormControl<Date | null>;
  endDate: import('@angular/forms').FormControl<Date | null>;
  minPrice: import('@angular/forms').FormControl<number>;
  maxPrice: import('@angular/forms').FormControl<number>;
  minDurationHours: import('@angular/forms').FormControl<number>;
  maxDurationHours: import('@angular/forms').FormControl<number>;
  currency: import('@angular/forms').FormControl<string>;
  sort: import('@angular/forms').FormControl<ExperienceSortOption>;
}

export interface ExperienceSearchFormValue {
  term: string;
  startDate: Date | null;
  endDate: Date | null;
  minPrice: number;
  maxPrice: number;
  minDurationHours: number;
  maxDurationHours: number;
  currency: string;
  sort: ExperienceSortOption;
}

export interface ExperienceResult {
  provider: ExperienceProvider;
  trackId: string;
  productCode?: string;
  destinationIds?: number[];
  avatarUrl?: string;
  supplier?: ViatorSupplierProductInfo;
  title?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  priceFrom?: number;
  currency?: string;
  duration?: string;
  imageUrl?: string;
  productUrl?: string;
  raw: unknown;
}

export interface ExperienceMapMarker {
  destinationId?: number;
  latitude: number;
  longitude: number;
  label?: string;
}

export interface ViatorFreetextProductFiltering {
  destination?: string;
  dateRange?: ViatorRangeDate;
  price?: ViatorRangeNumber;
  rating?: ViatorRangeNumber;
  durationInMinutes?: ViatorRangeNumber;
  tags?: number[];
  flags?: string[];
  includeAutomaticTranslations?: boolean;
}

export interface ViatorFreetextProductSorting {
  sort?: ViatorFreetextProductSort;
  order?: ViatorSortDirection;
}

export interface ViatorSearchTypeConfig {
  searchType: ViatorSearchType;
  pagination?: ViatorProductSearchPagination;
}

export interface ViatorFreetextSearchRequest {
  searchTerm: string;
  productFiltering?: ViatorFreetextProductFiltering;
  productSorting?: ViatorFreetextProductSorting;
  searchTypes: ViatorSearchTypeConfig[];
  currency: string;
}

export interface ViatorProductSearchResponse {
  products?: unknown[] | { results?: unknown[]; totalCount?: number };
  totalCount?: number;
}

export interface ViatorFreetextSearchResponse {
  products?: unknown[] | { results?: unknown[]; totalCount?: number };
  destinations?: unknown[];
  attractions?: unknown[];
}

export interface ViatorDestinationCenter {
  latitude?: number;
  longitude?: number;
}

export interface ViatorDestinationLookup {
  destinationId: number;
  name?: string;
  type?: string;
  parentDestinationId?: number;
  lookupId?: string;
  destinationUrl?: string;
  defaultCurrencyCode?: string;
  timeZone?: string;
  iataCodes?: string[];
  countryCallingCode?: string;
  languages?: string[];
  plusCode?: string;
  center?: ViatorDestinationCenter;
}

export interface ViatorDestinationsResponse {
  destinations?: ViatorDestinationLookup[];
  totalCount?: number;
}

export interface ViatorLocationAddress {
  street?: string;
  administrativeArea?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
}

export interface ViatorLocationCenter {
  latitude?: number;
  longitude?: number;
}

export interface ViatorLocation {
  reference: string;
  provider?: string;
  name?: string;
  unstructuredAddress?: string;
  address?: ViatorLocationAddress;
  center?: ViatorLocationCenter;
}

export interface ViatorLocationsResponse {
  locations: ViatorLocation[];
}

export interface ViatorSupplierContact {
  email?: string;
  address?: string;
  phone?: string;
  countryCode?: string;
}

export interface ViatorSupplierProductInfo {
  reference: string;
  name: string;
  type: string;
  logo?: string;
  productCode: string;
  contact?: ViatorSupplierContact;
}

export interface ViatorSuppliersResponse {
  suppliers: ViatorSupplierProductInfo[];
}

export interface ViatorLocationReference {
  ref?: string;
}

export interface ViatorLogisticsPoint {
  location?: ViatorLocationReference;
  description?: string;
}

export interface ViatorRedemptionInfo {
  redemptionType?: string;
  locations?: ViatorLocationReference[];
  specialInstructions?: string;
}

export interface ViatorPickupLocation {
  location?: ViatorLocationReference;
  pickupType?: string;
}

export interface ViatorTravelerPickupInfo {
  pickupOptionType?: string;
  allowCustomTravelerPickup?: boolean;
  locations?: ViatorPickupLocation[];
  minutesBeforeDepartureTimeForPickup?: number;
  additionalInfo?: string;
}

export interface ViatorProductLogistics {
  start?: ViatorLogisticsPoint[];
  end?: ViatorLogisticsPoint[];
  redemption?: ViatorRedemptionInfo;
  travelerPickup?: ViatorTravelerPickupInfo;
}

export interface ViatorProductDetail {
  productCode?: string;
  title?: string;
  description?: string;
  images?: {
    variants?: {
      height?: number;
      width?: number;
      url?: string;
    }[];
  }[];
  logistics?: ViatorProductLogistics;
}

export interface ExperienceSearchPinDialogData {
  destinationId: number;
  destinationName?: string;
  results: ExperienceResult[];
  source?: 'chat';
}

export interface ExperienceListDialogData {
  destinationIds: number[];
  destinationName?: string;
}

export interface ExperienceSearchDetailDialogData {
  result: ExperienceResult;
}

export interface ExperienceDetailLocationItem {
  ref: string;
  name?: string;
  address?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

export interface ExperienceDetailMapMarker {
  latitude: number;
  longitude: number;
  label?: string;
  iconUrl?: string;
}
