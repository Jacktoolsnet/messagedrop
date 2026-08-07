#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${script_dir}/generated"
api_url="${MESSAGEDROP_API_URL:-http://localhost:3000}"

mkdir -p "${output_dir}"
# These files are disposable diagnostics. Remove earlier samples so that every
# run contains only the diagnostics enabled below.
if [[ "${TRIPGO_KEEP_OLD_SAMPLES:-0}" != "1" ]]; then
  find "${output_dir}" -maxdepth 1 -type f -name '*.json' -delete
fi

# For the current development step only the local stops around Halchter are
# fetched by default. The older diagnostics remain available through their
# explicit feature flags below.
if [[ "${TRIPGO_FETCH_LOCATIONS:-1}" == "1" ]]; then
  printf 'Fetching TripGo stops around Halchter ...\n'
  node "${script_dir}/../../services/tripgo/scripts/fetch-raw-locations-sample.js" \
    "${output_dir}/locations-halchter-raw.json" \
    "${output_dir}/locations-halchter-request.json"
fi

fetch_diagnostic_route() {
  local name="$1"
  local from_lat="$2"
  local from_lng="$3"
  local to_lat="$4"
  local to_lng="$5"
  local locale="$6"
  local mode="${7:-pt_pub}"
  local operator="${8:-}"
  local modes_json

  modes_json="$(node -e '
    const modes = process.argv[1].split(",").map((mode) => mode.trim()).filter(Boolean);
    process.stdout.write(JSON.stringify(modes));
  ' "${mode}")"

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
      \"modes\": ${modes_json}
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
if [[ "${TRIPGO_FETCH_REGIONS:-0}" == "1" ]]; then
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
fi

if [[ "${TRIPGO_FETCH_ROUTES:-0}" == "1" ]]; then
  # TripGo uses Sydney in its own /latest.json documentation. This short and
  # frequent light-rail connection is therefore a stronger real-time test than
  # an international long-distance journey. Besides routing and /service, the
  # raw diagnostic script now stores the direct /latest response as well.
  fetch_diagnostic_route "sydney-central-circular-quay" \
    "-33.8830" "151.2069" "-33.8611" "151.2101" "en" "pt_pub_tram" \
    "au-nsw-lightrail-cbd-SLR"

  # Check the flight provider independently before testing the inter-modal
  # door-to-door combination used by the route dialog.
  fetch_diagnostic_route "hamburg-airport-munich-airport-flight" \
    "53.6304" "9.9882" "48.3538" "11.7861" "de" "in_air"
  fetch_diagnostic_route "hamburg-munich-flight-transit" \
    "53.5511" "9.9937" "48.1374" "11.5755" "de" "in_air,pt_pub"
  fetch_diagnostic_route "hannover-munich-flight-transit" \
    "52.3759" "9.7320" "48.1374" "11.5755" "de" "in_air,pt_pub"
fi

if [[ "${TRIPGO_FETCH_ROAD_SAMPLES:-0}" == "1" ]]; then
  # Same route with all three unscheduled road/path modes. Comparing the raw
  # segment templates shows whether TripGo structures car instructions
  # differently from its walking and bicycle instructions.
  fetch_diagnostic_route "wolfenbuettel-braunschweig-car" \
    "52.1625" "10.5369" "52.2647" "10.5239" "de" "me_car"
  fetch_diagnostic_route "wolfenbuettel-braunschweig-bicycle" \
    "52.1625" "10.5369" "52.2647" "10.5239" "de" "me_mic_bic"
  fetch_diagnostic_route "wolfenbuettel-braunschweig-walk" \
    "52.1625" "10.5369" "52.2647" "10.5239" "de" "wa_wal"
fi

printf 'TripGo samples written to %s\n' "${output_dir}"
