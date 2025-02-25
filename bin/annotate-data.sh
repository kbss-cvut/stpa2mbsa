#!/bin/bash

INPUT_FILE_NAME=loss-scenarios.tsv
INPUT_FILE=./data/AIDA/$INPUT_FILE_NAME

if [ ! "$#" -eq 0 ]; then
	echo Transforms STPA from $INPUT_FILE to ttl
        echo Usage :  $0
        echo Example:
        echo "  $0 "
        exit
fi


FUNCTION_ID=transform-data

SPIPES_SERVICE=http://172.25.48.1:8080/s-pipes

DIR="$(dirname $(realpath -s $0))"

OUTPUT_FILE=./target/AIDA/annotated-scenarios.ttl

echo "==================================="
echo "INFO: s-pipes service url $SPIPES_SERVICE"
echo "INFO: function id $FUNCTION_ID"
echo "INFO: input file $INPUT_FILE"
echo "==================================="

cd $DIR/../$DATASET_TYPE
mkdir -p ./target

URL="$SPIPES_SERVICE/service?_pId=$FUNCTION_ID&datasetResource=@$INPUT_FILE_NAME"
INPUT_FILE_ABSOLUTE="`realpath $INPUT_FILE`"

set -x
set -e

# TODO use --fail-with-body when having curl 7.76; # rerun without --fail to see the error from the server
curl --fail --location --request POST  \
	--header 'Accept: text/turtle' \
	--form 'files=@"'${INPUT_FILE_ABSOLUTE}'"' \
	"$URL" > $OUTPUT_FILE

set +x

