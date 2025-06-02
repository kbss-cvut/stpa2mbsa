#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

CONFIG_FILE="$PROJECT_ROOT/pipeline.conf"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "[ERROR] Configuration file not found: $CONFIG_FILE" >&2
    exit 1
fi
source "$CONFIG_FILE"

GRAPHDB_SPARQL_ENDPOINT="$GRAPHDB_BASE_URL/repositories/$GRAPHDB_REPOSITORY_ID"
GRAPHDB_STATEMENTS_ENDPOINT="$GRAPHDB_BASE_URL/repositories/$GRAPHDB_REPOSITORY_ID/statements"

log_info() {
    echo "[INFO] $(date +'%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date +'%Y-%m-%d %H:%M:%S') - $1" >&2
    exit 1
}

validate_file_exists() {
    if [ ! -f "$1" ]; then
        log_error "Required file not found: $1"
    fi
}

run_command() {
    log_info "Executing: $1 ..."
    "$@"
    local status=$?
    if [ $status -ne 0 ]; then
        log_error "Command failed with status $status: $1"
    fi
    return $status
}

wait_for_service() {
    local url_to_check="$1"
    local service_name="$2"
    local timeout_seconds="${3:-120}"
    local interval_seconds=5
    log_info "Waiting for $service_name at $url_to_check (timeout: ${timeout_seconds}s)..."
    local elapsed_time=0
    while [ $elapsed_time -lt $timeout_seconds ]; do
        if curl -s -L -o /dev/null --connect-timeout 3 --max-time 5 "$url_to_check"; then
            log_info "$service_name responded at $url_to_check!"
            log_info "Giving an additional 5s for full initialization..."
            sleep 5
            log_info "$service_name should be ready."
            return 0
        fi
        sleep $interval_seconds
        elapsed_time=$((elapsed_time + interval_seconds))
    done
    return 1
}

cleanup_docker() {
    log_info "Attempting Docker cleanup for: $SPIPES_DOCKER_NAME..."
    if [ "$(docker ps -q -f name="^/${SPIPES_DOCKER_NAME}$")" ]; then
        log_info "Stopping container $SPIPES_DOCKER_NAME..."
        docker stop "$SPIPES_DOCKER_NAME" >/dev/null 2>&1 || true
    fi
    if [ "$(docker ps -aq -f name="^/${SPIPES_DOCKER_NAME}$")" ]; then
        log_info "Removing container $SPIPES_DOCKER_NAME..."
        docker rm "$SPIPES_DOCKER_NAME" >/dev/null 2>&1 || true
    fi
    log_info "Docker cleanup for $SPIPES_DOCKER_NAME complete."
}

trap cleanup_docker EXIT INT TERM

setup_and_validate() {
    log_info "=== Setup & Validation ==="
    mkdir -p "$OUTPUT_DIR"
    validate_file_exists "$STPA_SCENARIOS_TTL_FILE"
    validate_file_exists "$MBSA_SOURCE_EXCEL"
    validate_file_exists "$LOSS_SCENARIOS_TSV_FILE"
    validate_file_exists "$PYTHON_SCRIPT_GEN_EQUIPMENT"
    validate_file_exists "$PYTHON_SCRIPT_PRE_ANNOTATE"
    validate_file_exists "$PYTHON_SCRIPT_HTML2RDF"
    validate_file_exists "$S_PIPES_SCRIPT_DEPLOY_VOCAB"
    validate_file_exists "$OBSERVER_QUERY_FILE"
    log_info "Initial validation complete."
}

generate_equipment_ttl() {
    log_info "=== Generating MBSA Annotation Vocabulary (equipment.ttl) ==="
    run_command "$PYTHON_EXE" "$PYTHON_SCRIPT_GEN_EQUIPMENT" "$MBSA_SOURCE_EXCEL" "$EQUIPMENT_TTL_FILE" "$MBSA_NAMESPACE_URI"
    validate_file_exists "$EQUIPMENT_TTL_FILE"
    log_info "equipment.ttl generated: $EQUIPMENT_TTL_FILE"

    log_info "Copying $EQUIPMENT_TTL_FILE to $S_PIPES_DEFINITIONS_DIR_HOST/equipment.ttl..."
    run_command cp "$EQUIPMENT_TTL_FILE" "$S_PIPES_DEFINITIONS_DIR_HOST/equipment.ttl"
    validate_file_exists "$S_PIPES_DEFINITIONS_DIR_HOST/equipment.ttl"
    log_info "equipment.ttl copied for S-Pipes container."
}

pre_annotate_scenario_html() {
    log_info "=== Pre-annotating STPA Scenarios into HTML (for Termit Annotation) ==="
    run_command "$PYTHON_EXE" "$PYTHON_SCRIPT_PRE_ANNOTATE" \
        "$STPA_SCENARIOS_TTL_FILE" \
        "$SCENARIOS_HTML_FOR_TERMIT" \
        --stpa_ns "$STPA_NAMESPACE_URI"
    validate_file_exists "$SCENARIOS_HTML_FOR_TERMIT"
    log_info "Pre-annotated scenarios HTML generated for Termit: $SCENARIOS_HTML_FOR_TERMIT"
}

start_spipes_docker() {
    log_info "=== Starting S-Pipes Docker Container ==="
    cleanup_docker

    log_info "Starting S-Pipes Docker container '$SPIPES_DOCKER_NAME' from '$SPIPES_DOCKER_IMAGE'..."
    run_command docker run -d --name "$SPIPES_DOCKER_NAME" \
        -v "$S_PIPES_DEFINITIONS_DIR_HOST:$S_PIPES_DEFINITIONS_DIR_CONTAINER" \
        -p "$SPIPES_HOST_PORT:$SPIPES_CONTAINER_PORT" \
        "$SPIPES_DOCKER_IMAGE"

    log_info "S-Pipes Docker container '$SPIPES_DOCKER_NAME' started. Waiting for service..."
    if ! wait_for_service "$SPIPES_CHECK_URL" "S-Pipes Service" 120; then
        log_info "S-Pipes service timed out. Displaying full logs from '$SPIPES_DOCKER_NAME':"
        docker logs "$SPIPES_DOCKER_NAME"
        log_info "--- End of S-Pipes Docker logs ---"
        log_error "S-Pipes service at $SPIPES_CHECK_URL did not become ready."
    fi
}

deploy_vocab_to_termit() {
    log_info "=== Deploying MBSA Vocabulary via S-Pipes (to Termit) ==="
    run_command "bash" "$S_PIPES_SCRIPT_DEPLOY_VOCAB" "$OUTPUT_DIR"
    log_info "Vocabulary deployment via S-Pipes initiated."
}

pause_for_annotation() {
    log_info "=== Manual Scenario Annotation ==="
    echo ""
    echo "------------------------------------------------------------------------------------"
    echo "ACTION REQUIRED: Perform scenario annotations in Termit."
    echo "Use the pre-annotated HTML file: $SCENARIOS_HTML_FOR_TERMIT"
    echo "The MBSA vocabulary should be available (S-Pipes at $SPIPES_CHECK_URL)."
    echo ""
    echo "Once done, export your annotations as an HTML file from Termit and save it as:"
    echo "  => $ANNOTATIONS_HTML_FROM_TERMIT (in $DATA_INSTANCE_DIR)"
    echo ""
    echo "------------------------------------------------------------------------------------"
    read -p "Press [Enter] to continue AFTER saving the annotated HTML file..."
    validate_file_exists "$ANNOTATIONS_HTML_FROM_TERMIT"
    log_info "Annotated HTML file found."
}

convert_annotated_html_to_rdf() {
    log_info "=== Converting Annotated HTML from Termit to RDF ==="
    run_command "$PYTHON_EXE" "$PYTHON_SCRIPT_HTML2RDF" "$ANNOTATIONS_HTML_FROM_TERMIT" "$ANNOTATIONS_TTL_FOR_GRAPHDB"
    validate_file_exists "$ANNOTATIONS_TTL_FOR_GRAPHDB"
    log_info "Annotated scenarios converted to RDF: $ANNOTATIONS_TTL_FOR_GRAPHDB"
}

generate_observers_graphdb() {
    log_info "=== Generating Observer Conditions via GraphDB ==="

    log_info "Clearing repository '$GRAPHDB_REPOSITORY_ID' (default graph)..."
    CLEANUP_QUERY="CLEAR DEFAULT"
    HTTP_CODE_CLEAN=$(curl -s -o /dev/null -w "%{http_code}" -X POST --data-urlencode "update=$CLEANUP_QUERY" "$GRAPHDB_STATEMENTS_ENDPOINT")
    if [ "$HTTP_CODE_CLEAN" -ne 204 ] && [ "$HTTP_CODE_CLEAN" -ne 200 ]; then log_error "GraphDB cleanup failed: HTTP $HTTP_CODE_CLEAN."; fi
    log_info "GraphDB default graph cleared (HTTP: $HTTP_CODE_CLEAN)."

    log_info "Loading TTL files into GraphDB default graph..."
    LOAD_FILES=("$STPA_SCENARIOS_TTL_FILE" "$EQUIPMENT_TTL_FILE" "$ANNOTATIONS_TTL_FOR_GRAPHDB")

    for file_to_load in "${LOAD_FILES[@]}"; do
        validate_file_exists "$file_to_load"
        log_info "Loading $file_to_load..."
        HTTP_CODE_LOAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type:text/turtle" --data-binary "@$file_to_load" "$GRAPHDB_STATEMENTS_ENDPOINT")
        if [ "$HTTP_CODE_LOAD" -ne 204 ] && [ "$HTTP_CODE_LOAD" -ne 200 ]; then log_error "Failed to load $file_to_load. HTTP $HTTP_CODE_LOAD."; fi
        log_info "$file_to_load loaded (HTTP: $HTTP_CODE_LOAD)."
    done

    log_info "Executing Observer SPARQL Query..."
    validate_file_exists "$OBSERVER_QUERY_FILE"
    OBSERVER_QUERY_CONTENT=$(cat "$OBSERVER_QUERY_FILE")

    HTTP_CODE_QUERY=$(curl -s -o "$OBSERVER_RESULTS_FILE" -w "%{http_code}" \
        -X POST -H "Accept:application/sparql-results+json" \
        --data-urlencode "query=$OBSERVER_QUERY_CONTENT" \
        "$GRAPHDB_SPARQL_ENDPOINT")

    if [ "$HTTP_CODE_QUERY" -ne 200 ]; then log_error "Observer SPARQL query failed: HTTP $HTTP_CODE_QUERY. Response: $(cat $OBSERVER_RESULTS_FILE)"; fi
    validate_file_exists "$OBSERVER_RESULTS_FILE"
    log_info "Observer results saved to $OBSERVER_RESULTS_FILE"

    log_info "--- Observer Results ---"
    cat "$OBSERVER_RESULTS_FILE"
    echo ""
    log_info "--- End of Observer Results ---"
}

log_info "Starting STPA to MBSA Observer Generation Pipeline..."

setup_and_validate
generate_equipment_ttl
pre_annotate_scenario_html
start_spipes_docker
deploy_vocab_to_termit
pause_for_annotation
convert_annotated_html_to_rdf
generate_observers_graphdb

log_info "=== Pipeline Completed Successfully! ==="
