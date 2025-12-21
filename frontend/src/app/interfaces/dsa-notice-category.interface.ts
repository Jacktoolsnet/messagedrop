export type DsaNoticeCategory =
    | ''
    | 'privacy'       // Privacy / personal data (doxxing)
    | 'ip_rights'     // Copyright / trademark / other third-party rights
    | 'violence_crime'// Violence, threats, or criminal incitement
    | 'hate_harass'   // Hate speech, harassment, discrimination
    | 'sexual'        // Pornographic or sexual content
    | 'child_safety'  // Sexual content involving minors
    | 'fraud'         // Fraud, deception, impersonation, false claims
    | 'malware'       // Malware or security circumvention
    | 'spam_abuse'    // Spam, abusive automation, service abuse
    | 'illegal_source'// Leaked or unauthorized sources
    | 'other';        // Other illegal or prohibited content
