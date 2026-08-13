#!/usr/bin/env bash
set -uo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${script_dir}/generated"
fetch_script="${script_dir}/../../services/overpass/scripts/fetch-raw-poi-sample.js"
analyze_script="${script_dir}/../../services/overpass/scripts/analyze-poi-sample.js"
categories="${OVERPASS_SAMPLE_CATEGORIES:-hotel,accommodation}"
limit="${OVERPASS_SAMPLE_LIMIT:-500}"
delay_seconds="${OVERPASS_SAMPLE_DELAY_SECONDS:-3}"
retry_delay_seconds="${OVERPASS_SAMPLE_RETRY_DELAY_SECONDS:-15}"
max_attempts="${OVERPASS_SAMPLE_MAX_ATTEMPTS:-3}"
api_timeout_ms="${OVERPASS_API_TIMEOUT_MS:-90000}"
query_timeout_seconds="${OVERPASS_QUERY_TIMEOUT_SECONDS:-60}"
selected_cities=",${OVERPASS_SAMPLE_CITIES:-hannover,wolfenbuettel,ingolstadt,stockholm,kopenhagen},"
failures=()
request_count=0

mkdir -p "${output_dir}"

if [[ "${selected_cities}" != *",hannover,"* \
  && "${selected_cities}" != *",wolfenbuettel,"* \
  && "${selected_cities}" != *",ingolstadt,"* \
  && "${selected_cities}" != *",stockholm,"* \
  && "${selected_cities}" != *",kopenhagen,"* ]]; then
  printf 'No known city selected in OVERPASS_SAMPLE_CITIES.\n' >&2
  exit 2
fi

# Generated responses are disposable diagnostics. By default every run contains
# only the selected cities, making comparisons between runs unambiguous.
if [[ "${OVERPASS_KEEP_OLD_SAMPLES:-0}" != "1" ]]; then
  find "${output_dir}" -maxdepth 1 -type f -name '*.json' -delete
fi

city_selected() {
  local name="$1"
  [[ "${selected_cities}" == *",${name},"* ]]
}

fetch_city() {
  local name="$1"
  local south="$2"
  local west="$3"
  local north="$4"
  local east="$5"
  local attempt
  local fetched=0

  if ! city_selected "${name}"; then
    return
  fi

  if (( request_count > 0 )); then
    sleep "${delay_seconds}"
  fi
  request_count=$((request_count + 1))

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    printf 'Fetching Overpass hotel sample for %s (attempt %s/%s) ...\n' \
      "${name}" "${attempt}" "${max_attempts}"
    if OVERPASS_SAMPLE_SOUTH="${south}" \
      OVERPASS_SAMPLE_WEST="${west}" \
      OVERPASS_SAMPLE_NORTH="${north}" \
      OVERPASS_SAMPLE_EAST="${east}" \
      OVERPASS_SAMPLE_CATEGORIES="${categories}" \
      OVERPASS_SAMPLE_LIMIT="${limit}" \
      OVERPASS_API_TIMEOUT_MS="${api_timeout_ms}" \
      OVERPASS_QUERY_TIMEOUT_SECONDS="${query_timeout_seconds}" \
      node "${fetch_script}" \
        "${output_dir}/${name}-hotels-raw.json" \
        "${output_dir}/${name}-hotels-request.json"; then
      fetched=1
      break
    fi
    if (( attempt < max_attempts )); then
      printf 'Retrying %s in %s seconds ...\n' "${name}" "${retry_delay_seconds}" >&2
      sleep "${retry_delay_seconds}"
    fi
  done

  if (( fetched == 0 )); then
    printf 'Overpass sample for %s failed; continuing with the other cities.\n' "${name}" >&2
    failures+=("${name}")
    return
  fi

  if ! node "${analyze_script}" \
    "${output_dir}/${name}-hotels-raw.json" \
    "${output_dir}/${name}-hotels-analysis.json"; then
    printf 'Analysis for %s failed; continuing with the other cities.\n' "${name}" >&2
    failures+=("${name}:analysis")
  fi
}

# Bounding boxes are intentionally modest so they remain well below the
# service's default OVERPASS_MAX_BBOX_AREA and public Overpass queries stay
# predictable.
fetch_city "hannover"       "52.34" "9.65"  "52.43" "9.85"
fetch_city "wolfenbuettel" "52.13" "10.50" "52.19" "10.61"
fetch_city "ingolstadt"    "48.70" "11.34" "48.81" "11.51"
fetch_city "stockholm"     "59.26" "17.90" "59.40" "18.20"
fetch_city "kopenhagen"    "55.61" "12.42" "55.74" "12.72"

printf 'Overpass samples written to %s\n' "${output_dir}"
if (( ${#failures[@]} > 0 )); then
  printf 'Failed samples: %s\n' "${failures[*]}" >&2
  exit 1
fi
