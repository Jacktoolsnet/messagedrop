import { BoundingBox } from './bounding-box';

export const OVERPASS_SUBCATEGORIES = {
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
  amenities: ['toilets']
} as const;

export type OverpassCategory = keyof typeof OVERPASS_SUBCATEGORIES;
export type OverpassSubcategory = typeof OVERPASS_SUBCATEGORIES[OverpassCategory][number];

export interface OverpassPoi {
  id: string;
  osmType: 'node' | 'way' | 'relation';
  osmId: number;
  category: OverpassCategory;
  subtype: OverpassSubcategory;
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
    wikidata?: string;
    wikipedia?: string;
  };
  source: { provider: 'OpenStreetMap'; url: string };
}

export interface OverpassNearbyResponse {
  status: number;
  pois: OverpassPoi[];
  count: number;
  cache: 'hit' | 'database' | 'stale' | 'stale-if-error' | 'miss';
}

export interface OverpassViewport {
  bounds: BoundingBox[];
  zoom: number;
  categories: Partial<Record<OverpassCategory, OverpassSubcategory[]>>;
}
