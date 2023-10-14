#!/bin/bash

# One time job to backfill

if [ -z "$BUCKET_ID" ]; then
    echo "Error: BUCKET_ID environment variable is not set."
    exit 1
fi

bq query --use_legacy_sql=false --format=json 'SELECT TO_HEX(SHA256(json)) as id, json FROM `benchmark-results.speedometer3.submission` ORDER by created desc LIMIT 100 OFFSET 0' > results.json

NUM_ROWS=$(jq 'length' results.json)

for ((i=0; i<$NUM_ROWS; i++)); do
    ID=$(jq -r ".[${i}].id" results.json)
    if ! gsutil -q stat "gs://${BUCKET_ID}/${ID}.json"; then
      jq -r ".[${i}].json" results.json > "${ID}.json"
      gsutil cp "${ID}.json" "gs://${BUCKET_ID}/"
      rm "${ID}.json"
    else
        echo "File ${ID}.json already exists in gs://${BUCKET_ID}/. Skipping upload."
    fi
done

rm results.json

echo "Process completed. Files uploaded to gs://${BUCKET_ID}/"
