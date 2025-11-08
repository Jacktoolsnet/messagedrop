export interface JwtPayload {
    exp: number;
    [key: string]: string | number | boolean | null | string[] | number[] | undefined;
}
