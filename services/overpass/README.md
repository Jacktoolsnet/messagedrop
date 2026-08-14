# MessageDrop Overpass service

A bounded, cached adapter for selected OpenStreetMap points of interest. Clients cannot submit arbitrary Overpass QL. They select server-side categories and a validated viewport instead.

## Local configuration

Copy the relevant values from `.env.overpass.example` into the ignored root `.env`. The default local port is `3900`.

The service-to-service endpoints require a JWT with audience `service.overpass`:

- `GET /overpass/health`
- `GET /overpass/categories`
- `POST /overpass/nearby`
- `POST /overpass/website-metadata`
- `GET /overpass/metadata-jobs`
- `POST /overpass/metadata-jobs`
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
  "categories": ["accommodation", "amenities"],
  "subcategories": {
    "accommodation": ["hotel", "guest_house", "hostel"],
    "amenities": ["toilets"]
  },
  "limit": 200
}
```

Supported categories are defined in `categories.js`. The viewport area and result count are limited by `OVERPASS_MAX_BBOX_AREA` and `OVERPASS_MAX_RESULTS`.
The server validates every requested subcategory against that catalog. The
`amenities/toilets` selection covers public toilets and excludes objects marked
with `access=private`, `access=customers`, or `access=no`; paid public toilets
remain included.

## Website header metadata

Metadata for a POI website can be loaded separately after obtaining its URL
from a nearby result:

```json
POST /overpass/website-metadata
{
  "url": "https://www.parkhotel-wolfenbuettel.de/"
}
```

The endpoint reads only a bounded HTML `<head>` and returns publisher-provided
title, description, canonical URL, language, favicon, Open Graph, Twitter Card,
and JSON-LD metadata when present. It does not derive values from the visible
page body. Results use the same bounded memory and PostgreSQL cache as nearby
queries.

For SSRF protection, only public HTTPS targets on the standard port are
accepted. Every DNS result and redirect target is checked; local and private
addresses are rejected. Download size, timeout, and redirect limits are
configured with `OVERPASS_WEBSITE_METADATA_*`.

After every successful country import, a separate durable enrichment job finds
the distinct HTTPS websites referenced by active POIs. Each normalized website
is requested only once per refresh cycle. Requests run sequentially with a
one-second delay by default. Successful metadata is refreshed after 30 days;
failed websites are retried after 24 hours. The admin backend triggers a
due-check every day at 04:00 in `Europe/Berlin` by default. The schedule is
configurable with `OVERPASS_METADATA_CRON` and
`OVERPASS_METADATA_TIMEZONE`. On every service start, interrupted jobs are
recovered and missing or stale metadata is processed automatically.
Metadata is stored once per normalized URL and added to local POI responses as
`websiteMetadata`.

Configure this lifecycle with `OVERPASS_WEBSITE_METADATA_REFRESH_DAYS`,
`OVERPASS_WEBSITE_METADATA_RETRY_HOURS`,
`OVERPASS_WEBSITE_METADATA_DELAY_MS`, and
`OVERPASS_WEBSITE_METADATA_JOB_MAX_URLS`.

## Persistent cache

The service uses PostgreSQL as its durable cache and a bounded in-memory cache
for hot entries. Create the database configured by `OVERPASS_DATABASE_URL` or
the `OVERPASS_DB_*` settings before starting the service. On startup the service
creates `tableOverpassCache` and its index automatically.

For the local development configuration, create the database once with:

```bash
npm run db:create
```

During development, an obsolete schema can be replaced explicitly. Stop the
Overpass service first; this command irreversibly removes its cache, jobs,
versions, and POIs:

```bash
npm run db:reset -- --yes
```

The configured PostgreSQL user needs `CREATEDB` permission for that command.
Alternatively, create `messagedrop_overpass` with an administrator account and
assign ownership to the configured `OVERPASS_DB_USER`.

Fresh database entries are returned directly. Older entries are returned while
they are refreshed in the background, and may be used as `stale-if-error` when
the public Overpass endpoint is unavailable. Retention and freshness windows
are configured with the `OVERPASS_*CACHE*` and `OVERPASS_DATABASE_RETENTION_DAYS`
settings in `.env.overpass.example`.

## Local POI dataset

For interactive map requests the service prefers imported OSM data over the
public Overpass instances. A request is answered locally when one imported
dataset completely covers its bounding box. An empty local result is final and
does not trigger an upstream request. Outside imported regions, the existing
cached Overpass fallback remains available.

The repeatable Wolfenbüttel import creates a durable import job, downloads the current Niedersachsen PBF
extract from Geofabrik, cuts out the wider Wolfenbüttel area, filters the tags
defined in `categories.js`, and converts all supported nodes, ways and
relations. POIs are first written to a new immutable dataset version. Only
after that version is complete does a short transaction switch the active
version pointer. Nearby requests therefore keep using the previous complete
version throughout an update and start using the new one immediately after the
switch.

Install the required Osmium command once on Debian/Ubuntu:

```bash
sudo apt update
sudo apt install osmium-tool
```

Then run from the service directory:

```bash
npm run dataset:import:wolfenbuettel
```

For the complete German extract:

```bash
npm run dataset:import:germany
```

The administration catalog is built from Geofabrik's machine-readable download
index and cached locally for 24 hours. It lists all countries for which a
complete country extract is currently available, grouped by continent.
The last catalog remains usable if Geofabrik is temporarily unavailable.
Selecting Germany uses Geofabrik's country extract. The import applies the selected
Osmium tag expressions before conversion, so only the configured POI categories
and subcategories enter PostgreSQL—not the full OSM country dataset.

Import jobs are queued globally and processed strictly one at a time. The large
downloaded PBF is deleted immediately after tag filtering; each smaller working
file is likewise deleted as soon as the following stage has completed. Cleanup
also runs after failures. POIs are normalized and inserted in bounded batches,
so a country import does not accumulate the complete GeoJSON result in memory.
When the Germany version becomes active it replaces the old Wolfenbüttel test
dataset, avoiding duplicate storage while preserving the old active data until
the atomic switch succeeds.

The default imports every configured main category. A subset can be selected
without changing the program:

```bash
npm run dataset:import:wolfenbuettel -- \
  --categories accommodation,tourism,amenities
```

The initial Geofabrik download can be several gigabytes. The source PBF is
deleted immediately after filtering and is downloaded again for the next
update. To force refresh semantics for a manual import:

```bash
npm run dataset:import:wolfenbuettel -- --refresh
```

Temporary downloads and the cached Geofabrik catalog are stored below
`services/overpass/downloads/` by default. Set `OVERPASS_DOWNLOAD_DIR` to use
another writable directory; relative values are resolved from the Overpass
service directory. The directory is created automatically and its contents are
excluded from Git. The service creates the directory during startup, before it
initializes import jobs. All automatically downloaded runtime files (country
PBFs and the Geofabrik catalog) use this directory.

Generated PBF and GeoJSON sequence files are ignored by Git. The database
tables `tableOverpassDataset`, `tableOverpassDatasetVersion`,
`tableOverpassPoiVersion`, and `tableOverpassImportJob` are created
automatically both by the service and by the import command. A previously
created development database from before the versioned model should be
recreated once. No PostGIS extension is needed; bounded latitude/longitude
indexes are sufficient for the current POI queries.

Successful imports delete retired versions after the atomic switch by default.
For a temporary database rollback window, retain a number of old versions with
`OVERPASS_DATASET_RETIRED_VERSIONS` or `--keep-versions`:

```bash
npm run dataset:import:wolfenbuettel -- --keep-versions 1
```

Failed jobs keep the active version unchanged and store their error in
`tableOverpassImportJob`. A partial or failed import can therefore never become
visible to nearby requests. The job table also prevents two active imports for
the same dataset.

## Admin-controlled imports

The admin backend can start imports through service-JWT protected endpoints:

- `GET /overpass/import-catalog`
- `POST /overpass/import-jobs`
- `GET /overpass/import-jobs`
- `GET /overpass/import-jobs/:jobId`

The POST body contains `datasetId`, `categories`, and `refresh`. It returns
immediately with a job record; Osmium continues in a child process. Starting an
already active dataset is idempotent and returns the existing job.

The admin backend stores its schedule in `tableOverpassImportSettings` and its
trigger history in `tableOverpassImportDispatch`. Both tables are created with
`CREATE TABLE IF NOT EXISTS` during a normal admin-backend startup, including
on an existing production database. Configure `OVERPASS_BASE_URL` and, when
needed, `OVERPASS_PORT` for the admin backend. Its service signing key must be
trusted by the Overpass service as issuer `service.admin-backend`.

After a successful import, restart the service. `GET /overpass/health` then
reports `mode: "local"`, and local nearby responses contain `cache: "local"`
plus the dataset ID and import timestamp in `source`.

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
