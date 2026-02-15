export interface ConsentSettings {
    disclaimer: boolean;
    privacyPolicy: boolean;
    termsOfService: boolean;
    ageAdultConfirmed: boolean;
    ageMinorWithParentalConsentConfirmed: boolean;
    // Legacy field (older app versions)
    ageConfirmed?: boolean;
}

export type LegalConsentKey = 'disclaimer' | 'privacyPolicy' | 'termsOfService';
export type ConsentKey = LegalConsentKey | 'ageConsent';
