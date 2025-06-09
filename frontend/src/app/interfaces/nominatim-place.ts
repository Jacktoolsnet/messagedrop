export interface NominatimPlace {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    address: {
        [key: string]: string; // z. B. "city", "postcode", "country", etc.
    };
    type: string;
    importance?: number;
    icon?: string;
    class?: string;
    licence?: string;
}
