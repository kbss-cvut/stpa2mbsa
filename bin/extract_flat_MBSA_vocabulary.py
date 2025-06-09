import pandas as pd
from rdflib import Graph, Namespace, Literal, URIRef
from rdflib.namespace import RDF, RDFS, OWL, XSD, DCTERMS
import sys
import re


def sanitize_for_uri(text):
    text = str(text)
    text = text.replace(" ", "_")
    text = text.replace(".", "_")
    text = re.sub(r'[^a-zA-Z0-9_]', '', text)
    if not text:
        return "sanitized_empty_label"
    return text


def generate_flat_vocabulary(input_excel_file, output_ttl_file, mbsa_namespace_uri):
    try:
        df = pd.read_excel(input_excel_file, sheet_name="Data")
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        sys.exit(1)

    g = Graph()
    MBSA_NS = Namespace(mbsa_namespace_uri)

    g.bind("mbsa", MBSA_NS)
    g.bind("rdf", RDF)
    g.bind("rdfs", RDFS)
    g.bind("owl", OWL)
    g.bind("dcterms", DCTERMS)
    g.bind("xsd", XSD)

    ontology_uri = URIRef(mbsa_namespace_uri)
    g.add((ontology_uri, RDF.type, OWL.Ontology))
    g.add((ontology_uri, OWL.versionIRI, MBSA_NS['v0.1']))

    uri_fragment_tracker = {}

    for _, row in df.iterrows():
        original_tech_id = str(row['Technical_id']).strip()
        nature_str = str(row['Nature']).strip()
        parent_name_csv = str(row['Parent']).strip() if pd.notna(row['Parent']) else ""
        name_csv = str(row['Name']).strip()
        description_str = str(row['Description']).strip() if pd.notna(row['Description']) else ""

        if parent_name_csv:
            label_for_uri_and_display = f"{parent_name_csv}.{name_csv}"
        else:
            label_for_uri_and_display = name_csv

        base_uri_local_name = sanitize_for_uri(label_for_uri_and_display)

        final_uri_local_name = base_uri_local_name

        if base_uri_local_name in uri_fragment_tracker:
            existing_nature = uri_fragment_tracker[base_uri_local_name]['nature']
            if existing_nature != nature_str:
                final_uri_local_name = f"{base_uri_local_name}_{nature_str}"
                print(f"WARNING: URI collision detected for base name '{base_uri_local_name}'. "
                      f"Concept '{label_for_uri_and_display}' (Nature: {nature_str}) "
                      f"collides with existing concept of Nature: {existing_nature}. "
                      f"Using '{final_uri_local_name}' for current concept to ensure distinctness.")

        if final_uri_local_name not in uri_fragment_tracker:
            uri_fragment_tracker[final_uri_local_name] = {'nature': nature_str}

        subject_uri = MBSA_NS[final_uri_local_name]

        rdf_class = MBSA_NS[nature_str]

        g.add((subject_uri, RDF.type, rdf_class))
        g.add((subject_uri, RDFS.label, Literal(label_for_uri_and_display)))
        g.add((subject_uri, MBSA_NS.originalTechnicalId, Literal(original_tech_id)))

        if description_str:
            g.add((subject_uri, DCTERMS.description, Literal(description_str)))

        if nature_str == "Event":
            prob_law = str(row['Probability law']).strip() if pd.notna(row['Probability law']) else ""
            lambda_val_str = str(row['Lambda']).strip() if pd.notna(row['Lambda']) else ""
            if prob_law:
                g.add((subject_uri, MBSA_NS.probabilityLaw, Literal(prob_law)))
            if lambda_val_str:
                try:
                    g.add((subject_uri, MBSA_NS.lambdaValue, Literal(float(lambda_val_str))))
                except ValueError:
                    if lambda_val_str:
                        g.add((subject_uri, MBSA_NS.lambdaValue, Literal(lambda_val_str)))

        if nature_str == "StateVariable":
            domain_str = str(row['Domain']).strip() if pd.notna(row['Domain']) else ""
            initial_value_str = str(row['Initial value']).strip() if pd.notna(row['Initial value']) else ""
            if domain_str:
                g.add((subject_uri, MBSA_NS.valueDomainDescription, Literal(domain_str)))
            if initial_value_str:
                g.add((subject_uri, MBSA_NS.initialValueLiteral, Literal(initial_value_str)))

    g.serialize(destination=output_ttl_file, format="turtle")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python extract_mbsa_for_annotation.py <input_excel_file> <output_ttl_file> <namespace_uri>")
        sys.exit(1)

    input_excel, output_ttl, namespace_uri_arg = sys.argv[1], sys.argv[2], sys.argv[3]

    generate_flat_vocabulary(input_excel, output_ttl, namespace_uri_arg)
    print(
        f"Flat vocabulary TTL file (labels as [<Parent>.]<Name>) generated: {output_ttl} using namespace <{namespace_uri_arg}>")