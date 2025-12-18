export interface ConsentSettings {
    disclaimer: boolean;
    privacyPolicy: boolean;
    termsOfService: boolean;
    ageConfirmed: boolean;
}

export type ConsentKey = keyof ConsentSettings;
