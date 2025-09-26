export interface ConsentSettings {
    disclaimer: boolean;
    privacyPolicy?: boolean;
}

export type ConsentKey = keyof ConsentSettings;