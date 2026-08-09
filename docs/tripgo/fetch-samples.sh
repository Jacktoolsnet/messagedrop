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

# Location diagnostics are optional while the Oslo routing issue is being
# investigated. Enable them explicitly with TRIPGO_FETCH_LOCATIONS=1.
if [[ "${TRIPGO_FETCH_LOCATIONS:-0}" == "1" ]]; then
  printf 'Fetching TripGo stops around Halchter ...\n'
  node "${script_dir}/../../services/tripgo/scripts/fetch-raw-locations-sample.js" \
    "${output_dir}/locations-halchter-raw.json" \
    "${output_dir}/locations-halchter-request.json"

  printf 'Fetching TripGo stops around Braunschweig Hauptbahnhof ...\n'
  TRIPGO_LOCATIONS_LAT="52.2525" \
  TRIPGO_LOCATIONS_LNG="10.5406" \
  TRIPGO_LOCATIONS_CELL_RADIUS="1" \
  TRIPGO_LOCATIONS_REGION="DE_NI_Hanover" \
  node "${script_dir}/../../services/tripgo/scripts/fetch-raw-locations-sample.js" \
    "${output_dir}/locations-braunschweig-hbf-raw.json" \
    "${output_dir}/locations-braunschweig-hbf-request.json"
fi

# Ferry-stop diagnostic for central Oslo and the inner Oslofjord islands. A
# larger cell radius is intentional: at map zoom 16 only a small section is
# visible at once, while the ferry terminals are spread across the waterfront
# and several islands.
if [[ "${TRIPGO_FETCH_OSLO_FERRY_LOCATIONS:-0}" == "1" ]]; then
  fetch_oslo_ferry_locations() {
    local name="$1"
    local latitude="$2"
    local longitude="$3"

    printf 'Fetching TripGo ferry stops around %s ...\n' "${name}"
    TRIPGO_LOCATIONS_LAT="${latitude}" \
    TRIPGO_LOCATIONS_LNG="${longitude}" \
    TRIPGO_LOCATIONS_CELL_RADIUS="1" \
    TRIPGO_LOCATIONS_REGION="NO_Oslo" \
    TRIPGO_LOCATIONS_LOCALE="en" \
    node "${script_dir}/../../services/tripgo/scripts/fetch-raw-locations-sample.js" \
      "${output_dir}/locations-oslo-ferries-${name}-raw.json" \
      "${output_dir}/locations-oslo-ferries-${name}-request.json"
  }

  # Several small requests are considerably more reliable than a single
  # 49-cell response and still cover the waterfront and the island terminals.
  fetch_oslo_ferry_locations "waterfront" "59.9100" "10.7280"
  fetch_oslo_ferry_locations "inner-islands" "59.8920" "10.7300"
  fetch_oslo_ferry_locations "eastern-islands" "59.8840" "10.7550"
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
  local timeout_ms="${9:-${TRIPGO_API_TIMEOUT_MS:-15000}}"
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
    TRIPGO_API_TIMEOUT_MS="${timeout_ms}" \
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

# Optional diagnostic: a central Oslo journey from Oslo S to the
# Vigeland sculpture park. The separate requests make it possible to tell
# whether the regional data supports public transport generally and whether
# one of the exact mode combinations used by the route dialog is rejected.
if [[ "${TRIPGO_FETCH_OSLO_ROUTES:-0}" == "1" ]]; then
  oslo_from_lat="59.9109"
  oslo_from_lng="10.7522"
  oslo_to_lat="59.9271"
  oslo_to_lng="10.7003"

  fetch_diagnostic_route "oslo-central-vigeland-transit" \
    "${oslo_from_lat}" "${oslo_from_lng}" "${oslo_to_lat}" "${oslo_to_lng}" "en" "pt_pub"
  fetch_diagnostic_route "oslo-central-vigeland-car" \
    "${oslo_from_lat}" "${oslo_from_lng}" "${oslo_to_lat}" "${oslo_to_lng}" "en" "me_car"
  fetch_diagnostic_route "oslo-central-vigeland-bicycle" \
    "${oslo_from_lat}" "${oslo_from_lng}" "${oslo_to_lat}" "${oslo_to_lng}" "en" "me_mic_bic"
  fetch_diagnostic_route "oslo-central-vigeland-walk-transit" \
    "${oslo_from_lat}" "${oslo_from_lng}" "${oslo_to_lat}" "${oslo_to_lng}" "en" "wa_wal,pt_pub"
  fetch_diagnostic_route "oslo-central-vigeland-walk" \
    "${oslo_from_lat}" "${oslo_from_lng}" "${oslo_to_lat}" "${oslo_to_lng}" "en" "wa_wal"
fi

# Current default diagnostic: allow TripGo's dedicated car-ferry mode for the
# previously failing Hamburg-to-Copenhagen route. Both coordinates remain in
# the respective city centre. The direct request gets a generous timeout.
if [[ "${TRIPGO_FETCH_LONG_ROUTES:-1}" == "1" ]]; then
  fetch_diagnostic_route "hamburg-copenhagen-car-ferry" \
    "53.5505" "9.9925" "55.6761" "12.5683" "en" \
    "me_car,pt_pub_carferry" "" "120000"
fi

# The successful and failing baseline requests can be repeated explicitly when
# needed, but stay disabled during the focused car-ferry diagnostic.
if [[ "${TRIPGO_FETCH_LONG_BASELINES:-0}" == "1" ]]; then
  # Long route within Germany: Marienplatz to Hamburg Rathausmarkt.
  fetch_diagnostic_route "munich-hamburg-car" \
    "48.1374" "11.5755" "53.5505" "9.9925" "de" "me_car" "" "120000"

  # Shorter international route: Gustav Adolfs torg to Jernbanetorget.
  fetch_diagnostic_route "gothenburg-oslo-car" \
    "57.7075" "11.9675" "59.9110" "10.7528" "en" "me_car" "" "120000"

  # Medium international route: Hamburg Rathausmarkt to Radhuspladsen.
  fetch_diagnostic_route "hamburg-copenhagen-car" \
    "53.5505" "9.9925" "55.6761" "12.5683" "en" "me_car" "" "120000"
fi

if [[ "${TRIPGO_FETCH_OSLO_ISLAND_ROUTES:-0}" == "1" ]]; then
  # Hovedøya has no road connection to the mainland. These variants reveal
  # whether TripGo rejects private vehicles, combines them with the ferry, or
  # returns an unusable straight-line segment without navigable geometry.
  island_lat="59.89891"
  island_lng="10.73074"
  oslo_s_lat="59.9109"
  oslo_s_lng="10.7522"

  fetch_diagnostic_route "oslo-hovedoya-oslo-s-car" \
    "${island_lat}" "${island_lng}" "${oslo_s_lat}" "${oslo_s_lng}" "en" "me_car"
  fetch_diagnostic_route "oslo-hovedoya-oslo-s-car-transit" \
    "${island_lat}" "${island_lng}" "${oslo_s_lat}" "${oslo_s_lng}" "en" "me_car,pt_pub"
  fetch_diagnostic_route "oslo-hovedoya-oslo-s-bicycle" \
    "${island_lat}" "${island_lng}" "${oslo_s_lat}" "${oslo_s_lng}" "en" "me_mic_bic"
  fetch_diagnostic_route "oslo-hovedoya-oslo-s-bicycle-transit" \
    "${island_lat}" "${island_lng}" "${oslo_s_lat}" "${oslo_s_lng}" "en" "me_mic_bic,pt_pub"
fi

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
