#!/bin/bash

# Check if the output directory is provided as an argument
if [ "$#" -ne 1 ]; then
    echo "Deploys vocabulary from MBSA equipment.ttl file to ttl"
    echo "Usage: $0 <output_directory>"
    echo "Example:"
    echo "  $0 ./target"
    exit 1
fi

OUTPUT_DIR=$1

FUNCTION_ID=deploy-vocabulary
SPIPES_SERVICE=http://localhost:8080/s-pipes
DIR="$(dirname $(realpath -s $0))"
OUTPUT_FILE=$OUTPUT_DIR/vocabulary-reified.ttl.txt

echo "==================================="
echo "INFO: s-pipes service url $SPIPES_SERVICE"
echo "INFO: function id $FUNCTION_ID"
echo "INFO: output directory $OUTPUT_DIR"
echo "==================================="

mkdir -p "$OUTPUT_DIR"

URL="$SPIPES_SERVICE/service?_pId=$FUNCTION_ID"

set -x
set -e

# TODO use --fail-with-body when having curl 7.76; # rerun without --fail to see the error from the server
curl --fail --location --request GET \
    --header 'Accept: text/turtle' \
    "$URL" > "$OUTPUT_FILE"

set +x
