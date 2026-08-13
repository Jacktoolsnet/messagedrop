# MessageDrop Overpass service

A bounded, cached adapter for selected OpenStreetMap points of interest. Clients cannot submit arbitrary Overpass QL. They select server-side categories and a validated viewport instead.

## Local configuration

Copy the relevant values from `.env.overpass.example` into the ignored root `.env`. The default local port is `3900`.

The service-to-service endpoints require a JWT with audience `service.overpass`:

- `GET /overpass/health`
- `GET /overpass/categories`
- `POST /overpass/nearby`
- `GET /overpass/metrics`

Example request body:

```json
{
  "bounds": {
    "south": 52.34,
    "west": 9.65,
    "north": 52.43,
    "east": 9.85
  },
  "categories": ["hotel", "accommodation", "tourism"],
  "limit": 200
}
```

Supported categories are defined in `categories.js`. The viewport area and result count are limited by `OVERPASS_MAX_BBOX_AREA` and `OVERPASS_MAX_RESULTS`.

## Capture a raw sample

The capture script talks directly to the configured Overpass upstream and stores both the untouched response and optional request diagnostics:

```bash
npm run sample:fetch -- \
  samples/hannover-hotels.raw.json \
  samples/hannover-hotels.request.json
```

Coordinates, categories, and limit come from `OVERPASS_SAMPLE_*` environment variables. Raw samples are ignored by Git.

## Analyze a sample

```bash
npm run sample:analyze -- \
  samples/hannover-hotels.raw.json \
  samples/hannover-hotels.analysis.json
```

The report includes element types, tag-value distributions, field coverage, missing coordinates, common additional tags, and nearby same-name objects that may be duplicates.

Small curated fixtures used by automated tests live in `test/fixtures` and may be committed.

## Verification

```bash
npm test
npm run lint
```
