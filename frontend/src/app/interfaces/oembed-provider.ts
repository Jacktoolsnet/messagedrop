export interface OembedProvider {
    provider_name: string;
    provider_url: string;
    endpoints: [
        {
            schemes: string[];
            url: string;
            discovery?: boolean;
            formats?: string[];
        }
    ]
}
