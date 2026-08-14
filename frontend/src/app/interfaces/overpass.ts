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
  amenities: ['toilets'],
  religion: [
    'cathedral', 'church', 'chapel', 'mosque', 'synagogue', 'temple', 'shrine',
    'monastery', 'place_of_worship'
  ]
} as const;

export type OverpassCategory = keyof typeof OVERPASS_SUBCATEGORIES;
export type OverpassSubcategory = typeof OVERPASS_SUBCATEGORIES[OverpassCategory][number];

export const OVERPASS_CATEGORY_ICONS: Record<OverpassCategory, string> = {
  accommodation: 'hotel',
  tourism: 'photo_camera',
  leisure: 'sports_soccer',
  food_drink: 'restaurant',
  amenities: 'wc',
  religion: 'church'
};

export type OverpassAvailability = Partial<Record<OverpassCategory, readonly OverpassSubcategory[]>>;

export interface OverpassAvailabilityResponse {
  status: number;
  categories: OverpassCategory[];
  subcategories: Partial<Record<OverpassCategory, OverpassSubcategory[]>>;
  updatedAt: number;
}

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
    description?: string;
    descriptions?: Partial<Record<'de' | 'en' | 'es' | 'fr', string>>;
    inscription?: string;
    inscriptions?: Partial<Record<'de' | 'en' | 'es' | 'fr', string>>;
    wikidata?: string;
    wikipedia?: string;
  };
  websiteMetadata?: {
    url?: string;
    canonicalUrl?: string;
    language?: string;
    title?: string;
    description?: string;
    image?: string;
    favicon?: string;
    siteName?: string;
    type?: string;
    fetchedAt?: string;
    openGraph?: Record<string, unknown>;
    twitterCard?: Record<string, unknown>;
    structuredData?: unknown[];
  };
  source: { provider: 'OpenStreetMap'; url: string };
}

export interface OverpassNearbyResponse {
  status: number;
  pois: OverpassPoi[];
  count: number;
  cache: 'local' | 'hit' | 'database' | 'stale' | 'stale-if-error' | 'miss';
}

export interface OverpassViewport {
  bounds: BoundingBox[];
  zoom: number;
  categories: Partial<Record<OverpassCategory, OverpassSubcategory[]>>;
}
