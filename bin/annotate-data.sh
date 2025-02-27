#!/bin/bash

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 BASE_DIRECTORY"
    echo "Example:"
    echo "  $0 /path/to/base"
    exit 1
fi

BASE_DIRECTORY=$1
INPUT_FILE_NAME="loss-scenarios.tsv"
INPUT_FILE="$BASE_DIRECTORY/$INPUT_FILE_NAME"
OUTPUT_DIRECTORY="./target/$(basename $BASE_DIRECTORY)"
OUTPUT_FILE="$OUTPUT_DIRECTORY/annotated-scenarios.ttl"

FUNCTION_ID="transform-data"
SPIPES_SERVICE="http://172.25.48.1:8080/s-pipes"
DIR="$(dirname $(realpath -s $0))"

echo "==================================="
echo "INFO: s-pipes service url $SPIPES_SERVICE"
echo "INFO: function id $FUNCTION_ID"
echo "INFO: input file $INPUT_FILE"
echo "INFO: output directory $OUTPUT_DIRECTORY"
echo "==================================="

cd "$DIR/../$DATASET_TYPE"
mkdir -p "$OUTPUT_DIRECTORY"

URL="$SPIPES_SERVICE/service?_pId=$FUNCTION_ID&datasetResource=@$INPUT_FILE_NAME"
INPUT_FILE_ABSOLUTE="$(realpath $INPUT_FILE)"

set -x
set -e

# TODO use --fail-with-body when having curl 7.76; # rerun without --fail to see the error from the server
curl --fail --location --request POST \
    --header 'Accept: text/turtle' \
    --form "files=@\"${INPUT_FILE_ABSOLUTE}\"" \
    "$URL" > "$OUTPUT_FILE"

set +x

