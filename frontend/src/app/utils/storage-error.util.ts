export const isQuotaExceededError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const name =
    error instanceof DOMException
      ? error.name
      : typeof error === 'object' && error !== null && 'name' in error
        ? String((error as { name?: unknown }).name)
        : '';

  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || name === 'QuotaExceeded';
};
