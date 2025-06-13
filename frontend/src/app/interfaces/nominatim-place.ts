import { Address } from "./address";

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
    address: Address;
    boundingbox: [string, string, string, string];
    distance?: number;
}