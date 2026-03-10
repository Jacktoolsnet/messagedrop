export interface UserModerationReasonOption {
  code: string;
  label: string;
}

export const USER_POSTING_BLOCK_REASONS: readonly UserModerationReasonOption[] = [
  { code: 'illegal_content', label: 'Illegal or criminal content' },
  { code: 'rights_violation', label: 'Violation of third-party rights' },
  { code: 'harassment_or_threats', label: 'Insults, harassment or threats' },
  { code: 'hate_or_extremism', label: 'Hate speech, violence or extremist content' },
  { code: 'sexual_or_youth_endangering', label: 'Pornographic or youth-endangering content' },
  { code: 'sexual_content_minors', label: 'Sexual content involving minors' },
  { code: 'personal_data_exposure', label: 'Disclosure of personal data' },
  { code: 'fraud_or_impersonation', label: 'Fraud, deception or impersonation' },
  { code: 'spam_or_abusive_automation', label: 'Spam or abusive automation' },
  { code: 'malware_or_security_attack', label: 'Malware or security attack' },
  { code: 'circumvention_or_misuse', label: 'Circumvention or platform misuse' },
  { code: 'serious_or_repeated_violations', label: 'Serious or repeated violations' }
] as const;

export const USER_ACCOUNT_BLOCK_REASONS: readonly UserModerationReasonOption[] = [
  ...USER_POSTING_BLOCK_REASONS,
  { code: 'underage_or_missing_consent', label: 'Underage use or missing parental consent' }
] as const;

export const USER_ALL_BLOCK_REASONS: readonly UserModerationReasonOption[] = USER_ACCOUNT_BLOCK_REASONS;

export function findModerationReasonLabel(
  reason: string | null | undefined,
  options: readonly UserModerationReasonOption[] = USER_ALL_BLOCK_REASONS
): string {
  const normalized = String(reason || '').trim();
  if (!normalized) {
    return '—';
  }
  return options.find((option) => option.code === normalized)?.label || normalized;
}
