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

## Persistent cache

The service uses PostgreSQL as its durable cache and a bounded in-memory cache
for hot entries. Create the database configured by `OVERPASS_DATABASE_URL` or
the `OVERPASS_DB_*` settings before starting the service. On startup the service
creates `tableOverpassCache` and its index automatically.

For the local development configuration, create the database once with:

```bash
npm run db:create
```

The configured PostgreSQL user needs `CREATEDB` permission for that command.
Alternatively, create `messagedrop_overpass` with an administrator account and
assign ownership to the configured `OVERPASS_DB_USER`.

Fresh database entries are returned directly. Older entries are returned while
they are refreshed in the background, and may be used as `stale-if-error` when
the public Overpass endpoint is unavailable. Retention and freshness windows
are configured with the `OVERPASS_*CACHE*` and `OVERPASS_DATABASE_RETENTION_DAYS`
settings in `.env.overpass.example`.

## Capture a raw sample

For the repeatable multi-city capture, use the repository-level wrapper:

```bash
./docs/overpass/fetch-samples.sh
```

It writes the fixed Hannover, Wolfenbüttel, Ingolstadt, Stockholm, and
Kopenhagen samples to `docs/overpass/generated/`. See
`docs/overpass/README.md` for selecting individual cities and other options.

The lower-level capture command is available for one-off bounding boxes:

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
