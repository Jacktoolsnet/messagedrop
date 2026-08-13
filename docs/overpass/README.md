# Overpass development samples

This directory contains the repeatable data capture used to evaluate the
OpenStreetMap hotel and accommodation data. Generated upstream responses and
analysis reports are written to `generated/` and deliberately ignored by Git.

Run all configured city samples from the repository root:

```bash
./docs/overpass/fetch-samples.sh
```

The script currently captures:

- Hannover
- Wolfenbüttel
- Ingolstadt
- Stockholm
- Kopenhagen

For every city it creates:

- `<city>-hotels-raw.json` – untouched Overpass response
- `<city>-hotels-request.json` – query, bounds, duration, size and counts
- `<city>-hotels-analysis.json` – tag coverage and duplicate candidates

By default the query includes `hotel` and `accommodation` and returns at most
500 elements. Both settings can be changed without editing the script:

```bash
OVERPASS_SAMPLE_CATEGORIES=accommodation,tourism \
OVERPASS_SAMPLE_LIMIT=500 \
./docs/overpass/fetch-samples.sh
```

Run only one or a subset of the configured cities with a comma-separated list:

```bash
OVERPASS_SAMPLE_CITIES=wolfenbuettel ./docs/overpass/fetch-samples.sh

OVERPASS_SAMPLE_CITIES=stockholm,kopenhagen \
./docs/overpass/fetch-samples.sh
```

Old generated JSON files are removed before each run. Preserve them with:

```bash
OVERPASS_KEEP_OLD_SAMPLES=1 ./docs/overpass/fetch-samples.sh
```

Requests are delayed by three seconds to avoid sending a burst to the public
Overpass instance. Override the delay only when necessary:

```bash
OVERPASS_SAMPLE_DELAY_SECONDS=5 ./docs/overpass/fetch-samples.sh
```

Each city is retried up to three times because public Overpass instances may
temporarily respond with rate limits or timeouts. Queries use a 60-second
server timeout and a 90-second HTTP timeout in this wrapper. These defaults can
be changed with `OVERPASS_SAMPLE_MAX_ATTEMPTS`,
`OVERPASS_SAMPLE_RETRY_DELAY_SECONDS`, `OVERPASS_QUERY_TIMEOUT_SECONDS`, and
`OVERPASS_API_TIMEOUT_MS`.

The lower-level download and analysis programs remain in
`services/overpass/scripts/` for focused experiments. The wrapper in this
directory is the preferred repeatable workflow.
