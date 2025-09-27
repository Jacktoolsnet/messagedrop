export interface ConsentSettings {
    disclaimer: boolean;
    privacyPolicy: boolean;
    termsOfService: boolean;
}

export type ConsentKey = keyof ConsentSettings;