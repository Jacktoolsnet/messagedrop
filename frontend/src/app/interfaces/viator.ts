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
  products?: unknown[];
  totalCount?: number;
}

export interface ViatorFreetextSearchResponse {
  products?: unknown[];
  destinations?: unknown[];
  attractions?: unknown[];
}
