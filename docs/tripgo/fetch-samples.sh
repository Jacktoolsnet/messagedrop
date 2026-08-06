#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${script_dir}/generated"
api_url="${MESSAGEDROP_API_URL:-http://localhost:3000}"

mkdir -p "${output_dir}"

curl --silent --show-error --fail-with-body \
  "${api_url}/tripgo/health" \
  --output "${output_dir}/health.json"

curl --silent --show-error --fail-with-body \
  "${api_url}/tripgo/regions?locale=de" \
  --output "${output_dir}/regions-de.json"

curl --silent --show-error --fail-with-body \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
    "from": { "latitude": 52.520008, "longitude": 13.404954 },
    "to": { "latitude": 52.509648, "longitude": 13.376013 },
    "locale": "de",
    "modes": ["pt_pub"]
  }' \
  "${api_url}/tripgo/routes" \
  --output "${output_dir}/route-berlin.json"

# Diagnostic route from near Im Kirchfeld in Halchter via Wolfenbüttel station
# to Braunschweig central station. It should contain bus 794 and a train. All
# coordinates can be overridden for an exact test.
wolf_from_lat="${TRIPGO_WOLFENBUETTEL_FROM_LAT:-52.14323}"
wolf_from_lng="${TRIPGO_WOLFENBUETTEL_FROM_LNG:-10.54569}"
wolf_to_lat="${TRIPGO_WOLFENBUETTEL_TO_LAT:-52.25232}"
wolf_to_lng="${TRIPGO_WOLFENBUETTEL_TO_LNG:-10.54042}"

curl --silent --show-error --fail-with-body \
  --request POST \
  --header 'Content-Type: application/json' \
  --data "{
    \"from\": { \"latitude\": ${wolf_from_lat}, \"longitude\": ${wolf_from_lng} },
    \"to\": { \"latitude\": ${wolf_to_lat}, \"longitude\": ${wolf_to_lng} },
    \"locale\": \"de\",
    \"modes\": [\"pt_pub\"]
  }" \
  "${api_url}/tripgo/routes" \
  --output "${output_dir}/route-wolfenbuettel.json"

# Keep the unmodified upstream response for checking fields such as
# serviceDirection, serviceName, platforms and externalData. The API key is
# read from the ignored root .env and is never written to the sample.
TRIPGO_SAMPLE_FROM_LAT="${wolf_from_lat}" \
TRIPGO_SAMPLE_FROM_LNG="${wolf_from_lng}" \
TRIPGO_SAMPLE_TO_LAT="${wolf_to_lat}" \
TRIPGO_SAMPLE_TO_LNG="${wolf_to_lng}" \
node "${script_dir}/../../services/tripgo/scripts/fetch-raw-route-sample.js" \
  "${output_dir}/route-wolfenbuettel-raw.json" \
  "${output_dir}/services-wolfenbuettel-raw.json"

printf 'TripGo samples written to %s\n' "${output_dir}"
