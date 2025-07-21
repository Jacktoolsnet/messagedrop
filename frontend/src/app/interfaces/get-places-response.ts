
export interface GetPlacesResponse {
    status: number,
    rows: {
        id: string,
        userId: string,
        name: string,
        subscribed: boolean,
        pinned: boolean,
        latMin: number,
        latMax: number,
        lonMin: number,
        lonMax: number
    }[]
}

