const CATEGORY_DEFINITIONS = Object.freeze({
  hotel: Object.freeze([
    Object.freeze({ key: 'tourism', values: Object.freeze(['hotel']) })
  ]),
  accommodation: Object.freeze([
    Object.freeze({
      key: 'tourism',
      values: Object.freeze([
        'guest_house', 'hostel', 'motel', 'apartment', 'chalet', 'resort',
        'camp_site', 'caravan_site', 'alpine_hut', 'wilderness_hut'
      ])
    })
  ]),
  tourism: Object.freeze([
    Object.freeze({
      key: 'tourism',
      values: Object.freeze([
        'attraction', 'museum', 'gallery', 'viewpoint', 'zoo', 'aquarium',
        'theme_park', 'artwork', 'picnic_site', 'information'
      ])
    }),
    Object.freeze({
      key: 'historic',
      values: Object.freeze(['castle', 'monument', 'memorial', 'ruins', 'archaeological_site'])
    })
  ]),
  leisure: Object.freeze([
    Object.freeze({
      key: 'leisure',
      values: Object.freeze([
        'park', 'nature_reserve', 'playground', 'fitness_centre', 'sports_centre',
        'swimming_pool', 'water_park', 'miniature_golf', 'golf_course', 'marina',
        'beach_resort', 'bowling_alley'
      ])
    })
  ]),
  food_drink: Object.freeze([
    Object.freeze({
      key: 'amenity',
      values: Object.freeze(['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'biergarten'])
    })
  ])
});

function categoryNames() {
  return Object.keys(CATEGORY_DEFINITIONS);
}

function categoryForTags(tags, requestedCategories = categoryNames()) {
  for (const category of requestedCategories) {
    const definitions = CATEGORY_DEFINITIONS[category] || [];
    if (definitions.some(({ key, values }) => values.includes(tags?.[key]))) return category;
  }
  return null;
}

module.exports = { CATEGORY_DEFINITIONS, categoryNames, categoryForTags };
