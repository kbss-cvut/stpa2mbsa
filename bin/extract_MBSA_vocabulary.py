import pandas as pd
from rdflib import Graph, Namespace, Literal, URIRef
from rdflib.namespace import RDF, RDFS, OWL, XSD, DCTERMS
import sys


def generate_ttl_with_full_path(input_excel_file, output_ttl_file, mbsa_namespace_uri):
    try:
        df = pd.read_excel(input_excel_file, sheet_name="Data")
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        sys.exit(1)

    g = Graph()

    MBSA_NS = Namespace(mbsa_namespace_uri)

    g.bind("mbsa", MBSA_NS)
    g.bind("rdf", RDF);
    g.bind("rdfs", RDFS);
    g.bind("owl", OWL);
    g.bind("dcterms", DCTERMS);
    g.bind("xsd", XSD)

    ontology_uri = URIRef(mbsa_namespace_uri)
    g.add((ontology_uri, RDF.type, OWL.Ontology))
    g.add((ontology_uri, OWL.versionIRI, MBSA_NS['v0.1']))

    abi_name_to_tech_id, item_info, global_value_defs = {}, {}, {}
    for _, row in df.iterrows():
        tech_id, nature, name = str(row['Technical_id']), str(row['Nature']), str(row['Name'])
        if nature == "Value":
            val_uri = MBSA_NS[f"val_{tech_id}"]
            if tech_id not in global_value_defs:
                global_value_defs[tech_id] = {'uri': val_uri, 'name': name}
                g.add((val_uri, RDF.type, MBSA_NS.Value));
                g.add((val_uri, MBSA_NS.technicalId, Literal(tech_id)));
                g.add((val_uri, RDFS.label, Literal(name)))
        parent_name_str = str(row['Parent']) if pd.notna(row['Parent']) else ""
        item_uri = MBSA_NS[f"item_{tech_id}"]
        item_info[tech_id] = {'uri': item_uri, 'name': name, 'parent_name_str': parent_name_str, 'nature': nature}
        if nature == "AtomicBrickInstance": abi_name_to_tech_id[name] = tech_id

    for _, row in df.iterrows():
        tech_id, nature, name = str(row['Technical_id']), str(row['Nature']), str(row['Name'])
        parent_name_str = str(row['Parent']) if pd.notna(row['Parent']) else ""
        if nature == "Value": continue

        if parent_name_str:
            display_label = f"{parent_name_str}.{name}"
            full_path_label = f"{nature}.{parent_name_str}.{name}"
        else:
            display_label = name
            full_path_label = f"{nature}.{name}"

        subject_uri = item_info[tech_id]['uri']
        rdf_class = MBSA_NS[nature]

        g.add((subject_uri, RDF.type, rdf_class))
        g.add((subject_uri, MBSA_NS.technicalId, Literal(tech_id)))

        g.add((subject_uri, RDFS.label, Literal(display_label)))
        g.add((subject_uri, MBSA_NS.fullPath, Literal(full_path_label)))

        if parent_name_str and nature != "AtomicBrickInstance":
            parent_abi_tech_id = abi_name_to_tech_id.get(parent_name_str)
            if parent_abi_tech_id:
                parent_uri = item_info[parent_abi_tech_id]['uri']
                if nature == "Event": g.add((subject_uri, MBSA_NS.isEventOf, parent_uri))

    g.serialize(destination=output_ttl_file, format="turtle")


if __name__ == "__main__":
    if len(sys.argv) != 4: print("Usage: python ..."); sys.exit(1)
    input_excel, output_ttl, namespace_uri_arg = sys.argv[1], sys.argv[2], sys.argv[3]
    generate_ttl_with_full_path(input_excel, output_ttl, namespace_uri_arg)
    print(f"Final TTL file generated: {output_ttl}")