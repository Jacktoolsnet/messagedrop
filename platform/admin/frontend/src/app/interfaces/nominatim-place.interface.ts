export interface NominatimAddress {
  road?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  country?: string;
}

export interface NominatimPlace {
  place_id: number;
  lat: number | string;
  lon: number | string;
  name?: string;
  display_name: string;
  address?: NominatimAddress;
}
