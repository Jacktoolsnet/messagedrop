#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${script_dir}/generated"
api_url="${MESSAGEDROP_API_URL:-http://localhost:3000}"

mkdir -p "${output_dir}"
# These files are disposable diagnostics. Remove earlier samples so that every
# run contains only the routes requested below and cannot be confused with
# stale responses.
find "${output_dir}" -maxdepth 1 -type f -name '*.json' -delete

fetch_diagnostic_route() {
  local name="$1"
  local from_lat="$2"
  local from_lng="$3"
  local to_lat="$4"
  local to_lng="$5"
  local locale="$6"
  local mode="${7:-pt_pub}"
  local operator="${8:-}"

  printf 'Fetching TripGo sample %s ...\n' "${name}"

  # Fetch the untouched upstream response first. It is the most useful file for
  # diagnosing real-time fields and is still valuable if our normalizer cannot
  # process a route returned by TripGo.
  if ! TRIPGO_SAMPLE_FROM_LAT="${from_lat}" \
    TRIPGO_SAMPLE_FROM_LNG="${from_lng}" \
    TRIPGO_SAMPLE_TO_LAT="${to_lat}" \
    TRIPGO_SAMPLE_TO_LNG="${to_lng}" \
    TRIPGO_SAMPLE_LOCALE="${locale}" \
    TRIPGO_SAMPLE_MODES="${mode}" \
    TRIPGO_SAMPLE_OPERATOR="${operator}" \
    node "${script_dir}/../../services/tripgo/scripts/fetch-raw-route-sample.js" \
      "${output_dir}/route-${name}-raw.json" \
      "${output_dir}/services-${name}-raw.json" \
      "${output_dir}/latest-${name}-raw.json"; then
    printf 'Raw sample %s failed; continuing with the other diagnostics.\n' "${name}" >&2
  fi

  if ! curl --silent --show-error --fail-with-body \
    --request POST \
    --header 'Content-Type: application/json' \
    --data "{
      \"from\": { \"latitude\": ${from_lat}, \"longitude\": ${from_lng} },
      \"to\": { \"latitude\": ${to_lat}, \"longitude\": ${to_lng} },
      \"locale\": \"${locale}\",
      \"modes\": [\"${mode}\"]
    }" \
    "${api_url}/tripgo/routes" \
    --output "${output_dir}/route-${name}.json"; then
    printf 'Normalized sample %s failed; continuing with its raw response.\n' "${name}" >&2
  fi
}

fetch_region_diagnostics() {
  local region="$1"

  printf 'Fetching TripGo provider details for %s ...\n' "${region}"
  if ! curl --silent --show-error --fail-with-body \
    "${api_url}/tripgo/region-info?region=${region}&locale=en" \
    --output "${output_dir}/region-info-${region}.json"; then
    printf 'Region info for %s failed; continuing.\n' "${region}" >&2
  fi
}

# Keep the region/provider catalogue from the authenticated API response. It
# lets us inspect which providers advertise real-time capabilities before
# choosing further diagnostic routes.
curl --silent --show-error --fail-with-body \
  "${api_url}/tripgo/regions?locale=en" \
  --output "${output_dir}/regions-providers.json"

# Regions used by the route samples plus established TripGo markets.
# regionInfo already includes every operator's realTimeStatus. Calling the
# global /info/operators endpoint for a regional data server results in a 400,
# so it is deliberately not needed for this diagnostic.
for region in \
  DE_BV_Munich DE_HH_Hamburg FR_IDF_Paris ES_MD_Madrid DK_Islands \
  SE_Stockholm AU_NSW_Sydney US_CA_LosAngeles US_IL_Chicago BE_BRU_Brussels; do
  fetch_region_diagnostics "${region}"
done

if [[ "${TRIPGO_FETCH_ROUTES:-1}" == "1" ]]; then
  # TripGo uses Sydney in its own /latest.json documentation. This short and
  # frequent light-rail connection is therefore a stronger real-time test than
  # an international long-distance journey. Besides routing and /service, the
  # raw diagnostic script now stores the direct /latest response as well.
  fetch_diagnostic_route "sydney-central-circular-quay" \
    "-33.8830" "151.2069" "-33.8611" "151.2101" "en" "pt_pub_tram" \
    "au-nsw-lightrail-cbd-SLR"
fi

printf 'TripGo samples written to %s\n' "${output_dir}"
