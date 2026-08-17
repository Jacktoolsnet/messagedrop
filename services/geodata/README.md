# MessageDrop Geodata service

The Geodata service imports selected OpenStreetMap POIs from Geofabrik country
extracts into PostgreSQL and serves them to MessageDrop. It no longer sends
interactive map requests to a public query API. Only categories, subcategories,
and countries enabled in the admin application are imported.

## Data source and licence

Geodata and POI records are © OpenStreetMap contributors and are available under
the Open Data Commons Open Database License 1.0 (ODbL). Country extracts are
obtained from the Geofabrik GmbH download service.

- OpenStreetMap copyright and licence: https://www.openstreetmap.org/copyright
- Geofabrik extracts: https://download.geofabrik.de/
- Repository notice: [DATA-LICENSE.md](DATA-LICENSE.md)

Keep `DATA-LICENSE.md` with database copies, backups, and exports created from
this service.

## Local configuration

Copy the required values from `.env.geodata.example` into the ignored root
`.env`. The default local port is `3900`; the default database is
`messagedrop_geodata`.

All application endpoints require a service JWT with audience
`service.geodata`:

- `GET /geodata/health`
- `GET /geodata/categories`
- `POST /geodata/nearby`
- `GET /geodata/import-catalog`
- `GET|POST /geodata/import-jobs`
- `GET /geodata/import-jobs/:jobId`
- `GET /geodata/metrics`

Supported POI types are defined in `categories.js`. Nearby requests are bounded
by `GEODATA_MAX_BBOX_AREA` and `GEODATA_MAX_RESULTS`. A request outside the
currently imported coverage returns an empty result with `coverage: false`.

## Database

The database must exist before the service starts. Tables and indexes are
created automatically on startup.

```bash
cd services/geodata
npm run db:create
```

For a clean, destructive recreation during development:

```bash
npm run db:reset -- --yes
```

The configured PostgreSQL user needs permission to create and drop databases.
No PostGIS extension is required.

Import job records are retained for 90 days by default. Cleanup
runs on startup and daily; queued and running jobs are preserved. Configure the
retention with `GEODATA_JOB_RETENTION_DAYS`.

## Imports

Install Osmium on Debian/Ubuntu:

```bash
sudo apt update
sudo apt install osmium-tool curl
```

Imports normally start from the admin application. Local development commands
are also available:

```bash
npm run dataset:import:wolfenbuettel
npm run dataset:import:germany
```

An import downloads one Geofabrik PBF at a time. Osmium filters the selected
tags before database insertion, so PostgreSQL receives only enabled POI types.
Temporary files are removed after each processing stage and after failures.
They and the cached Geofabrik catalog live in `services/geodata/downloads/` by
default; override this with `GEODATA_DOWNLOAD_DIR`.

POIs are written to a new immutable dataset version. A short transaction makes
the completed version active, so requests continue using the previous version
during processing. Failed or partial versions never become visible. Retired
versions are deleted after activation unless
`GEODATA_DATASET_RETIRED_VERSIONS` requests a rollback window.

Before downloading an existing dataset again, the importer compares the remote
ETag or Last-Modified value and the import configuration. An unchanged source
and unchanged category selection completes as `up_to_date`. Use `--force` only
when a deliberate rebuild is required.

## Admin integration

The admin backend stores global selection and scheduling data in
`tableGeodataImportSettings` and dispatch history in
`tableGeodataImportDispatch`. Both are created during a normal admin-backend
startup. Configure its connection to this service with `GEODATA_BASE_URL` and
`GEODATA_PORT`.

## Verification

```bash
npm test
npm run lint
```
