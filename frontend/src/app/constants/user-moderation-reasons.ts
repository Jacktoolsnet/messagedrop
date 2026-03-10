export const USER_POSTING_BLOCK_REASON_CODES = [
  'illegal_content',
  'rights_violation',
  'harassment_or_threats',
  'hate_or_extremism',
  'sexual_or_youth_endangering',
  'sexual_content_minors',
  'personal_data_exposure',
  'fraud_or_impersonation',
  'spam_or_abusive_automation',
  'malware_or_security_attack',
  'circumvention_or_misuse',
  'serious_or_repeated_violations'
] as const;

export const USER_ACCOUNT_BLOCK_REASON_CODES = [
  ...USER_POSTING_BLOCK_REASON_CODES,
  'underage_or_missing_consent'
] as const;

export function moderationReasonTranslationKey(reason: string | null | undefined): string | null {
  const normalized = String(reason || '').trim();
  return normalized ? `common.user.moderationReasons.${normalized}` : null;
}
