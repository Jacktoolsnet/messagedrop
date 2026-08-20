import { normalizeUtcTimestamp } from './utc-timestamp';

describe('normalizeUtcTimestamp', () => {
  it('treats legacy timestamps without a suffix as UTC', () => {
    expect(normalizeUtcTimestamp('2026-08-20T07:28:01')).toBe('2026-08-20T07:28:01.000Z');
  });

  it('normalizes timestamps with an explicit offset', () => {
    expect(normalizeUtcTimestamp('2026-08-20T09:28:01+02:00')).toBe('2026-08-20T07:28:01.000Z');
  });

  it('keeps invalid values unchanged', () => {
    expect(normalizeUtcTimestamp('invalid')).toBe('invalid');
  });
});
