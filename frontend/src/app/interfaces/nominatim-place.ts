export interface NominatimPlace {
    place_id: number;
    licence: string;
    osm_type: string;
    osm_id: number;
    lat: string;
    lon: string;
    class: string;
    type: string;
    place_rank: number;
    importance: number;
    addresstype: string;
    name?: string;
    display_name: string;
    address: {
        house_number?: string;
        road?: string;
        suburb?: string;
        city_district?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        postcode?: string;
        country?: string;
        country_code?: string;
        [key: string]: any;
    };
    boundingbox: [string, string, string, string];
    distance?: number;
}