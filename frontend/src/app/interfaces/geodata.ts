import { BoundingBox } from './bounding-box';

export const GEODATA_SUBCATEGORIES = {
  accommodation: [
    'hotel', 'guest_house', 'hostel', 'motel', 'apartment', 'chalet', 'resort',
    'camp_site', 'caravan_site', 'alpine_hut', 'wilderness_hut'
  ],
  tourism: [
    'attraction', 'museum', 'gallery', 'viewpoint', 'zoo', 'aquarium', 'theme_park',
    'artwork', 'picnic_site', 'information', 'castle', 'monument', 'memorial', 'ruins',
    'archaeological_site'
  ],
  leisure: [
    'park', 'nature_reserve', 'playground', 'fitness_centre', 'sports_centre',
    'swimming_pool', 'water_park', 'miniature_golf', 'golf_course', 'marina',
    'beach_resort', 'bowling_alley'
  ],
  food_drink: ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'biergarten'],
  amenities: [
    'toilets', 'townhall', 'courthouse', 'tax_office', 'register_office',
    'public_service_office', 'government_office'
  ],
  religion: [
    'cathedral', 'church', 'chapel', 'mosque', 'synagogue', 'temple', 'shrine',
    'monastery', 'place_of_worship'
  ]
} as const;

export type GeodataCategory = keyof typeof GEODATA_SUBCATEGORIES;
export type GeodataSubcategory = typeof GEODATA_SUBCATEGORIES[GeodataCategory][number];

export const GEODATA_CATEGORY_ICONS: Record<GeodataCategory, string> = {
  accommodation: 'hotel',
  tourism: 'photo_camera',
  leisure: 'sports_soccer',
  food_drink: 'restaurant',
  amenities: 'account_balance',
  religion: 'church'
};

export type GeodataAvailability = Partial<Record<GeodataCategory, readonly GeodataSubcategory[]>>;

export interface GeodataAvailabilityResponse {
  status: number;
  categories: GeodataCategory[];
  subcategories: Partial<Record<GeodataCategory, GeodataSubcategory[]>>;
  updatedAt: number;
}

export interface GeodataPoi {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  category: GeodataCategory;
  subtype: GeodataSubcategory;
  name: string | null;
  latitude: number;
  longitude: number;
  address: {
    street?: string;
    houseNumber?: string;
    postcode?: string;
    city?: string;
    country?: string;
  };
  contact: { phone?: string; website?: string; email?: string };
  properties: {
    stars?: string;
    rooms?: string;
    beds?: string;
    wheelchair?: string;
    openingHours?: string;
    description?: string;
    descriptions?: Partial<Record<'de' | 'en' | 'es' | 'fr', string>>;
    inscription?: string;
    inscriptions?: Partial<Record<'de' | 'en' | 'es' | 'fr', string>>;
    wikidata?: string;
    wikipedia?: string;
  };
  source: { provider: 'OpenStreetMap'; url: string };
}

export interface GeodataNearbyResponse {
  status: number;
  pois: GeodataPoi[];
  count: number;
  cache: 'local' | 'hit' | 'database' | 'stale' | 'stale-if-error' | 'miss';
}

export interface GeodataViewport {
  bounds: BoundingBox[];
  zoom: number;
  categories: Partial<Record<GeodataCategory, GeodataSubcategory[]>>;
}
