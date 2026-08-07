# TripGo development samples

This directory contains helper files for inspecting the TripGo integration.
Generated API responses are written to `generated/` and deliberately ignored
by Git because they can contain dynamic transport and location data.

The current sample fetch is intentionally limited by default to public-
transport stops around Halchter. Route, provider and real-time diagnostics are
skipped so the result remains small and unambiguous.

Run it with:

```bash
./docs/tripgo/fetch-samples.sh
```

The script reads `TRIPGO_API_KEY` from the ignored root `.env` and creates:

- `generated/locations-halchter-raw.json` – unmodified TripGo response
- `generated/locations-halchter-request.json` – requested cells and counts

TripGo's local location level divides the map into cells. By default the script
requests the centre cell around Halchter plus its eight neighbours. The centre,
region and number of neighbouring cells can be overridden:

```bash
TRIPGO_LOCATIONS_LAT=52.14 \
TRIPGO_LOCATIONS_LNG=10.54 \
TRIPGO_LOCATIONS_REGION=DE_NI_Hanover \
TRIPGO_LOCATIONS_CELL_RADIUS=1 \
./docs/tripgo/fetch-samples.sh
```

Old generated JSON files are removed before each run. To retain them, set
`TRIPGO_KEEP_OLD_SAMPLES=1`.

The previous diagnostics are still available, but must now be enabled
explicitly:

```bash
TRIPGO_FETCH_REGIONS=1 ./docs/tripgo/fetch-samples.sh
TRIPGO_FETCH_ROUTES=1 ./docs/tripgo/fetch-samples.sh
TRIPGO_FETCH_ROAD_SAMPLES=1 ./docs/tripgo/fetch-samples.sh
```

Set `TRIPGO_FETCH_LOCATIONS=0` in such a run if the Halchter sample is not
needed.
