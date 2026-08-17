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

Versioned ODbL exports are deliberately separate from the bounded application
API and are public:

- `GET /geodata/exports`
- `GET /geodata/exports/:datasetId/current/data`
- `GET /geodata/exports/:datasetId/current/metadata`
- `GET /geodata/exports/:datasetId/current/license`
- `GET /geodata/exports/:datasetId/:versionId/{data|metadata|license}`

The main backend streams the same resources below `/geodata/exports`, so the
Geodata service itself can remain on an internal network.

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

POIs are written to a new immutable dataset version. Before activation, the
service creates and fully validates a matching streaming `JSONL.gz` export,
`metadata.json`, and `LICENSE.txt`. Database and export use the same UUID. A
short transaction activates the database version only if its export is marked
ready, so a failed or partial export can never make new POIs visible.

Exports live in `services/geodata/exports/` by default; override this with
`GEODATA_EXPORT_DIR`. Retired database and export versions are deleted together
after activation unless `GEODATA_DATASET_RETIRED_VERSIONS` requests a rollback
and archive window. Active exports are never removed by cleanup.
Gzip compression defaults to level 6 and can be tuned with
`GEODATA_EXPORT_GZIP_LEVEL` (1–9).

The export metadata includes source provenance, selected categories and
subcategories, bounds, record count, compressed size, SHA-256, attribution and
ODbL URI. The public manifest always resolves downloads through the active
database pointer.

Before downloading an existing dataset again, the importer compares the remote
ETag or Last-Modified value and the import configuration. An unchanged source
and unchanged category selection completes as `up_to_date`. Use `--force` only
when a deliberate rebuild is required.

For database versions created before export support was installed, the next
ordinary import job creates the missing export directly from the active POIs
when source and import configuration are unchanged. It does not download or
rebuild the country extract in that case.

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
