#!/bin/bash

if [ ! "$#" -eq 0 ]; then
	echo Transforms reliability vocabulary from reliability-aviation-profile-components.ttl file to ttl
        echo Usage :  $0
        echo Example:
        echo "  $0 "
        exit
fi

FUNCTION_ID=transform-vocabulary

SPIPES_SERVICE=http://localhost:8080/s-pipes

DIR="$(dirname $(realpath -s $0))"

OUTPUT_FILE=./target/vocabulary.ttl.txt

echo "==================================="
echo "INFO: s-pipes service url $SPIPES_SERVICE"
echo "INFO: function id $FUNCTION_ID"
echo "==================================="

mkdir -p ./target

URL="$SPIPES_SERVICE/service?_pId=$FUNCTION_ID"

set -x
set -e

# TODO use --fail-with-body when having curl 7.76; # rerun without --fail to see the error from the server
curl --fail --location --request GET \
	--header 'Accept: text/turtle' \
	"$URL" > $OUTPUT_FILE

set +x

