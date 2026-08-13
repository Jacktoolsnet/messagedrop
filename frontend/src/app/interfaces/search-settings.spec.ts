import { applyOverpassAvailability, DEFAULT_SEARCH_SETTINGS } from './search-settings';

describe('applyOverpassAvailability', () => {
  it('disables unavailable categories and subcategories', () => {
    const settings = structuredClone(DEFAULT_SEARCH_SETTINGS);
    settings.accommodation.enabled = true;
    settings.tourism.enabled = true;

    const result = applyOverpassAvailability(settings, { accommodation: ['hotel'] });

    expect(result.accommodation.enabled).toBeTrue();
    expect(result.accommodation.subcategories['hotel']).toBeTrue();
    expect(result.accommodation.subcategories['hostel']).toBeFalse();
    expect(result.tourism.enabled).toBeFalse();
  });
});
