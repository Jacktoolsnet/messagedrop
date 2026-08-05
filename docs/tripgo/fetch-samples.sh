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

printf 'TripGo samples written to %s\n' "${output_dir}"

