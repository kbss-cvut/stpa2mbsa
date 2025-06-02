import argparse
import os
import re
import uuid
import html
from rdflib import Graph, Namespace, URIRef
from rdflib.namespace import RDF, RDFS


def get_scenario_sort_key(scenario_uri_str, stpa_ns_str):
    """
    Generates a sort key (major, minor) for scenario URIs like stpa:LS-1_10.
    """
    local_name = scenario_uri_str
    # Ensure stpa_ns_str ends with '#' or '/' if URIs are constructed that way
    # For simplicity, assuming stpa_ns_str is the base and local_name needs prefix removal
    if scenario_uri_str.startswith(stpa_ns_str):
        local_name = scenario_uri_str[len(stpa_ns_str):]

    if local_name.startswith("LS-"):
        parts_str = local_name[3:].split('_')
        if len(parts_str) == 2:
            try:
                major = int(parts_str[0])
                minor = int(parts_str[1])
                return (major, minor)
            except ValueError:
                # Fallback for non-numeric parts after LS-X_Y
                return (float('inf'), local_name)
    return (float('inf'), local_name)  # Default for non-matching/unparseable URIs


def pre_annotate_stpa_terms(stpa_ttl_file, output_html_file, stpa_ns_uri_str):
    """
    Reads STPA scenarios from stpa_ttl_file.
    Pre-annotates stpa:original-text for STPA entity instances linking to their
    STPA URIs (class "selected-occurrence").
    Also pre-annotates the scenario's stpa:context string (if found within
    original-text) linking to the scenario URI (class "proposed-occurrence").
    Outputs an HTML file with scenarios in natural sort order.
    """

    STPA_NS = Namespace(stpa_ns_uri_str)
    TERMIT_PROP_JE_VYSKYTEM = URIRef("http://onto.fel.cvut.cz/ontologies/application/termit/pojem/je-výskytem-termu")
    TERMIT_TYPE_VYSKYT = URIRef("http://onto.fel.cvut.cz/ontologies/application/termit/pojem/výskyt-termu")

    g_stpa = Graph()
    print(f"Loading STPA ontology/scenarios from: {stpa_ttl_file}")
    if not os.path.exists(stpa_ttl_file):
        print(f"ERROR: STPA file not found: {stpa_ttl_file}")
        return
    g_stpa.parse(stpa_ttl_file, format="turtle")

    stpa_entities_to_markup = []
    q_stpa_entities = """
        SELECT DISTINCT ?stpaEntityInstanceURI ?stpaEntityLabel
        WHERE {
            VALUES ?stpaType { stpa:Controller stpa:ControlledProcess stpa:ControlAction }
            ?stpaEntityInstanceURI rdf:type ?stpaType ;
                                 rdfs:label ?stpaEntityLabel .
        }
    """
    print("Querying for STPA entity instances to pre-annotate...")
    results = g_stpa.query(q_stpa_entities, initNs={'stpa': STPA_NS, 'rdfs': RDFS, 'rdf': RDF})

    for row in results:
        stpa_entities_to_markup.append({
            'label': str(row.stpaEntityLabel),
            'resource_uri': str(row.stpaEntityInstanceURI),
            'class_type': "assigned-term-occurrence selected-occurrence",
            'priority': 1
        })

    stpa_entities_to_markup.sort(key=lambda x: len(x['label']), reverse=True)

    if not stpa_entities_to_markup:
        print("Warning: No STPA entity instances found for pre-annotation.")
    else:
        print(f"Found {len(stpa_entities_to_markup)} STPA entity terms for pre-annotating.")

    html_output_lines = [
        "<!DOCTYPE html>", "<html lang=\"en\">", "<head>",
        "    <meta charset=\"UTF-8\">",
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
        "    <title>Pre-annotated STPA Scenarios</title>",
        "</head>", "<body>"
    ]

    q_scenarios = """
        SELECT ?scenarioURI ?originalText ?contextText
        WHERE {
            ?scenarioURI a stpa:LossScenario .
            OPTIONAL { ?scenarioURI stpa:original-text ?originalText . }
            OPTIONAL { ?scenarioURI stpa:context ?contextText . }
        }
        # ORDER BY removed, will be handled by Python
    """
    print("Fetching Loss Scenarios from STPA TTL file...")
    scenario_results_rdf = g_stpa.query(q_scenarios, initNs={'stpa': STPA_NS})

    scenario_data_list = []
    for scenario_row in scenario_results_rdf:
        scenario_uri_str = str(scenario_row.scenarioURI)
        original_text = str(scenario_row.originalText if scenario_row.originalText else "")
        context_text_str = str(scenario_row.contextText if scenario_row.contextText else "")

        scenario_data_list.append({
            'uri_str': scenario_uri_str,
            'original_text': original_text,
            'context_text': context_text_str,
            'sort_key': get_scenario_sort_key(scenario_uri_str, stpa_ns_uri_str)
        })

    scenario_data_list.sort(key=lambda x: x['sort_key'])
    print(f"Processing {len(scenario_data_list)} scenarios in natural sort order...")

    if not scenario_data_list:
        print("Warning: No STPA Loss Scenarios found in the input TTL file.")

    for scenario_data in scenario_data_list:
        scenario_uri_str = scenario_data['uri_str']
        original_text = scenario_data['original_text']
        context_text_str = scenario_data['context_text']

        if not original_text:
            if context_text_str:
                html_output_lines.append(f"<p></p>")
            else:
                print(f"Warning: Scenario {scenario_uri_str} has no stpa:original-text. Skipping.")
            continue

        all_potential_annotations = []

        for term_info in stpa_entities_to_markup:
            label_to_find = term_info['label']
            stpa_uri_for_term = term_info['resource_uri']
            pattern = r'\b' + re.escape(label_to_find) + r'\b'
            for match_obj in re.finditer(pattern, original_text, re.IGNORECASE):
                all_potential_annotations.append({
                    'start': match_obj.start(), 'end': match_obj.end(),
                    'text': match_obj.group(0),
                    'resource_uri': stpa_uri_for_term,
                    'class': term_info['class_type'],
                    'priority': term_info['priority']
                })

        if context_text_str:
            pattern_context = r'\b' + re.escape(context_text_str) + r'\b'
            for match_obj in re.finditer(pattern_context, original_text, re.IGNORECASE):
                is_covered_by_entity = False
                for entity_ann in all_potential_annotations:
                    if entity_ann['priority'] > 0 and \
                            entity_ann['start'] <= match_obj.start() and \
                            entity_ann['end'] >= match_obj.end() and \
                            entity_ann['text'] == match_obj.group(
                        0):  # check if it's the same text to avoid marking sub-parts
                        is_covered_by_entity = True
                        break
                if not is_covered_by_entity:
                    all_potential_annotations.append({
                        'start': match_obj.start(), 'end': match_obj.end(),
                        'text': match_obj.group(0),
                        'resource_uri': scenario_uri_str,
                        'class': "assigned-term-occurrence proposed-occurrence",
                        'priority': 0
                    })

        all_potential_annotations.sort(key=lambda x: (x['start'], -x['priority'], -(x['end'] - x['start'])))

        final_annotations = []
        last_match_end_pos = -1
        for ann in all_potential_annotations:
            if ann['start'] >= last_match_end_pos:
                final_annotations.append(ann)
                last_match_end_pos = ann['end']

        result_parts = []
        current_text_pos = 0
        for ann in final_annotations:
            if ann['start'] > current_text_pos:
                result_parts.append(html.escape(original_text[current_text_pos:ann['start']]))

            span_id_local = "pre_ann_" + uuid.uuid4().hex[:7]
            span_tag = (
                f'<span id="{span_id_local}" about="_:{span_id_local}" '
                f'property="{str(TERMIT_PROP_JE_VYSKYTEM)}" typeof="{str(TERMIT_TYPE_VYSKYT)}" '
                f'class="{ann["class"]}" '
                f'resource="{html.escape(ann["resource_uri"])}">'
                f'{html.escape(ann["text"])}</span>'
            )
            result_parts.append(span_tag)
            current_text_pos = ann['end']

        if current_text_pos < len(original_text):
            result_parts.append(html.escape(original_text[current_text_pos:]))

        final_annotated_html_line = "".join(result_parts)

        # Simplified HTML output: just the <p> tag for the annotated scenario text
        html_output_lines.append(f"<p>{final_annotated_html_line}</p>")

    if len(scenario_data_list) == 0:
        html_output_lines.append(
            "<p>No STPA Loss Scenarios with original text found in the input TTL file to process.</p>")

    html_output_lines.append("</body>")
    html_output_lines.append("</html>")

    with open(output_html_file, 'w', encoding='utf-8') as f_html:
        f_html.write("\n".join(html_output_lines))

    print(f"Pre-annotated HTML file generated: {output_html_file}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description="Pre-annotates STPA scenario texts. STPA entity labels (Controllers, etc.) found in 'original-text' "
                    "are linked to their STPA Instance URIs. The 'context' string is linked to its Scenario URI."
    )
    parser.add_argument("stpa_ttl_file",
                        help="Path to the STPA ontology/scenarios TTL file (e.g., loss-scenarios.ttl).")
    parser.add_argument("output_html_file",
                        help="Path for the output pre-annotated HTML file.")
    parser.add_argument("--stpa_ns",
                        default="http://www.fd.cvut.cz/chopamax/ontologies/stpa-mbsa#",
                        help="URI of the STPA namespace (default: http://www.fd.cvut.cz/chopamax/ontologies/stpa-mbsa#).")

    args = parser.parse_args()

    pre_annotate_stpa_terms(args.stpa_ttl_file, args.output_html_file, args.stpa_ns)