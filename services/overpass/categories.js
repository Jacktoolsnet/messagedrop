const CATEGORY_DEFINITIONS = Object.freeze({
  accommodation: definitions([
    ['hotel', 'tourism', ['hotel']],
    ['hotel', 'building', ['hotel']],
    ['guest_house', 'tourism', ['guest_house']],
    ['hostel', 'tourism', ['hostel']],
    ['motel', 'tourism', ['motel']],
    ['apartment', 'tourism', ['apartment']],
    ['chalet', 'tourism', ['chalet']],
    ['resort', 'tourism', ['resort']],
    ['camp_site', 'tourism', ['camp_site']],
    ['caravan_site', 'tourism', ['caravan_site']],
    ['alpine_hut', 'tourism', ['alpine_hut']],
    ['wilderness_hut', 'tourism', ['wilderness_hut']]
  ]),
  tourism: definitions([
    ['attraction', 'tourism', ['attraction']],
    ['museum', 'tourism', ['museum']],
    ['gallery', 'tourism', ['gallery']],
    ['viewpoint', 'tourism', ['viewpoint']],
    ['zoo', 'tourism', ['zoo']],
    ['aquarium', 'tourism', ['aquarium']],
    ['theme_park', 'tourism', ['theme_park']],
    ['artwork', 'tourism', ['artwork']],
    ['picnic_site', 'tourism', ['picnic_site']],
    ['information', 'tourism', ['information']],
    ['castle', 'historic', ['castle']],
    ['monument', 'historic', ['monument']],
    ['memorial', 'historic', ['memorial']],
    ['ruins', 'historic', ['ruins']],
    ['archaeological_site', 'historic', ['archaeological_site']]
  ]),
  leisure: definitions([
    ['park', 'leisure', ['park']],
    ['nature_reserve', 'leisure', ['nature_reserve']],
    ['playground', 'leisure', ['playground']],
    ['fitness_centre', 'leisure', ['fitness_centre']],
    ['sports_centre', 'leisure', ['sports_centre']],
    ['swimming_pool', 'leisure', ['swimming_pool']],
    ['water_park', 'leisure', ['water_park']],
    ['miniature_golf', 'leisure', ['miniature_golf']],
    ['golf_course', 'leisure', ['golf_course']],
    ['marina', 'leisure', ['marina']],
    ['beach_resort', 'leisure', ['beach_resort']],
    ['bowling_alley', 'leisure', ['bowling_alley']]
  ]),
  food_drink: definitions([
    ['restaurant', 'amenity', ['restaurant']],
    ['cafe', 'amenity', ['cafe']],
    ['bar', 'amenity', ['bar']],
    ['pub', 'amenity', ['pub']],
    ['fast_food', 'amenity', ['fast_food']],
    ['biergarten', 'amenity', ['biergarten']]
  ]),
  amenities: definitions([
    ['toilets', 'amenity', ['toilets'], [{ key: 'access', values: ['private', 'customers', 'no'] }]],
    ['townhall', 'amenity', ['townhall']],
    ['courthouse', 'amenity', ['courthouse']],
    ['tax_office', 'government', ['tax']],
    ['register_office', 'government', ['register_office']],
    ['public_service_office', 'government', ['public_service']],
    ['government_office', 'office', ['government']]
  ]),
  religion: definitions([
    ['cathedral', 'building', ['cathedral']],
    ['church', 'building', ['church']],
    ['chapel', 'building', ['chapel']],
    ['mosque', 'building', ['mosque']],
    ['synagogue', 'building', ['synagogue']],
    ['temple', 'building', ['temple']],
    ['shrine', 'building', ['shrine']],
    ['shrine', 'historic', ['wayside_shrine']],
    ['monastery', 'building', ['monastery']],
    ['monastery', 'amenity', ['monastery']],
    ['place_of_worship', 'amenity', ['place_of_worship']]
  ])
});

// Prefer the semantic purpose over a broad tourism tag when an object belongs
// to more than one selected category (for example a cathedral that is also
// tagged as tourism=attraction).
const CLASSIFICATION_PRIORITY = Object.freeze([
  'accommodation', 'religion', 'amenities', 'tourism', 'leisure', 'food_drink'
]);

function definitions(items) {
  return Object.freeze(items.map(([subcategory, key, values, exclude = []]) => Object.freeze({
    subcategory,
    key,
    values: Object.freeze(values),
    exclude: Object.freeze(exclude.map((rule) => Object.freeze({
      key: rule.key,
      values: Object.freeze(rule.values)
    })))
  })));
}

function categoryNames() {
  return Object.keys(CATEGORY_DEFINITIONS);
}

function subcategoryNames(category) {
  return [...new Set((CATEGORY_DEFINITIONS[category] || []).map(({ subcategory }) => subcategory))];
}

function categoryCatalog() {
  return Object.fromEntries(categoryNames().map((category) => [category, subcategoryNames(category)]));
}

function selectedDefinitions(category, selectedSubcategories) {
  const definitionsForCategory = CATEGORY_DEFINITIONS[category] || [];
  if (!selectedSubcategories) return definitionsForCategory;
  const selected = new Set(selectedSubcategories);
  return definitionsForCategory.filter(({ subcategory }) => selected.has(subcategory));
}

function categoryForTags(tags, requestedCategories = categoryNames(), requestedSubcategories = {}) {
  const requested = new Set(requestedCategories);
  const orderedCategories = [
    ...CLASSIFICATION_PRIORITY.filter((category) => requested.has(category)),
    ...requestedCategories.filter((category) => !CLASSIFICATION_PRIORITY.includes(category))
  ];
  for (const category of orderedCategories) {
    const matched = selectedDefinitions(category, requestedSubcategories[category])
      .find(({ key, values, exclude }) => values.includes(tags?.[key])
        && exclude.every((rule) => !rule.values.includes(tags?.[rule.key])));
    if (matched) return { category, subcategory: matched.subcategory };
  }
  return null;
}

module.exports = {
  CATEGORY_DEFINITIONS,
  categoryNames,
  subcategoryNames,
  categoryCatalog,
  selectedDefinitions,
  categoryForTags
};
