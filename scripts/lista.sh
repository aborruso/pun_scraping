#!/bin/bash

set -x
set -e
set -u
set -o pipefail

folder="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

data=$(stat -c %y "${folder}"/../pun_pdr.ndjson | cut -d' ' -f1)

jq -c '{status: .status, latitude: .coordinates.latitude, longitude: .coordinates.longitude, evse_id: .evse_id}' "${folder}"/../pun_pdr.ndjson > "${folder}"/../data/pun_pdr.jsonl

mlr -I --json sort -t evse_id "${folder}"/../data/pun_pdr.jsonl

mlr --ijsonl --ocsv cat "${folder}"/../data/pun_pdr.jsonl > "${folder}"/../data/pun_pdr.csv
