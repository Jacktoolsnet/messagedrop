export interface TranslateResponse {
    status: number,
    result?: {
        text: string,
        detectedSourceLang: string
    },
    error?: string
}

