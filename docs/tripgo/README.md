# TripGo development samples

This directory contains helper files for inspecting the TripGo integration.
Generated API responses are written to `generated/` and deliberately ignored
by Git because they can contain dynamic transport and location data.

With the MessageDrop backend and TripGo service running, execute:

```bash
./docs/tripgo/fetch-samples.sh
```

The backend URL can be overridden when necessary:

```bash
MESSAGEDROP_API_URL=http://localhost:3000 ./docs/tripgo/fetch-samples.sh
```

The script creates:

- `generated/health.json`
- `generated/regions-de.json`
- `generated/route-berlin.json`
- `generated/route-wolfenbuettel.json`
- `generated/route-wolfenbuettel-raw.json`

The Wolfenbüttel sample is intended to diagnose the direction information for
the circular bus line 794. The `raw` file contains TripGo's unmodified upstream
response, while the other file contains MessageDrop's normalized response.
The raw sample is fetched directly with `TRIPGO_API_KEY` from the ignored root
`.env`; the key itself is not included in the generated file.

The default origin is near Im Kirchfeld in Halchter and the default destination
is Wolfenbüttel station. Exact coordinates can be supplied when needed:

```bash
TRIPGO_WOLFENBUETTEL_FROM_LAT=52.14 \
TRIPGO_WOLFENBUETTEL_FROM_LNG=10.54 \
TRIPGO_WOLFENBUETTEL_TO_LAT=52.159149 \
TRIPGO_WOLFENBUETTEL_TO_LNG=10.53245 \
./docs/tripgo/fetch-samples.sh
```
