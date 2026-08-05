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

