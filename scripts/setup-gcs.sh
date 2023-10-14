#!/bin/bash

if [ -z "$BUCKET_ID" ]; then
    echo "Error: BUCKET_ID environment variable is not set."
    exit 1
fi

# https://cloud.google.com/storage/docs/using-cors#command-line_1
gcloud storage buckets update gs://${BUCKET_ID}/ --cors-file=cors-config.json

# https://cloud.google.com/storage/docs/access-control/making-data-public
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_ID} --member=allUsers --role=roles/storage.legacyObjectReader

