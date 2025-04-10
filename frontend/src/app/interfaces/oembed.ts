export interface Oembed {
    type: string,
    url?: string,
    html?: string,
    width?: number,
    height?: number,
    version: number,
    title?: string,
    author_name?: string,
    author_url?: string,
    provider_name?: string,
    provider_url?: string,
    cache_age?: number,
    thumbnail_url?: string,
    thumbnail_width?: number,
    thumbnail_height?: number
}
