import { GEODATA_SUBCATEGORIES, GeodataCategory } from './geodata';
import {
  applyGeodataAvailability,
  DEFAULT_SEARCH_SETTINGS,
  normalizePoiSetting,
  POSITIONED_EXTERNAL_PINS_MIN_ZOOM
} from './search-settings';

describe('search settings zoom limits', () => {
  it('starts Wikipedia and Geodata pins at the individually positioned zoom level', () => {
    expect(DEFAULT_SEARCH_SETTINGS.wikipedia.minZoom).toBe(POSITIONED_EXTERNAL_PINS_MIN_ZOOM);
    for (const category of Object.keys(GEODATA_SUBCATEGORIES) as GeodataCategory[]) {
      expect(DEFAULT_SEARCH_SETTINGS[category].minZoom).toBe(POSITIONED_EXTERNAL_PINS_MIN_ZOOM);
    }
  });

  it('raises previously stored Geodata zoom levels to the new minimum', () => {
    const normalized = normalizePoiSetting('tourism', { enabled: true, minZoom: 14 });

    expect(normalized.minZoom).toBe(POSITIONED_EXTERNAL_PINS_MIN_ZOOM);
  });
});

describe('applyGeodataAvailability', () => {
  it('disables unavailable categories and subcategories', () => {
    const settings = structuredClone(DEFAULT_SEARCH_SETTINGS);
    settings.accommodation.enabled = true;
    settings.tourism.enabled = true;

    const result = applyGeodataAvailability(settings, { accommodation: ['hotel'] });

    expect(result.accommodation.enabled).toBeTrue();
    expect(result.accommodation.subcategories['hotel']).toBeTrue();
    expect(result.accommodation.subcategories['hostel']).toBeFalse();
    expect(result.tourism.enabled).toBeFalse();
  });
});
