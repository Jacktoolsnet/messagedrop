export type DsaNoticeCategory =
    | ''
    | 'copyright'   // Copyright / IP infringement
    | 'hate'        // Hate speech / incitement
    | 'terror'      // Terrorism content
    | 'privacy'     // Privacy / personal data
    | 'other';      // Other illegal content