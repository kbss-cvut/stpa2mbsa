from rdflib import Graph, Namespace, Literal, URIRef
from rdflib.namespace import OWL, RDFS, RDF
import argparse  # For handling command-line arguments
import os  # For checking if files exist


def create_links(stpa_file_path, mbsa_file_path, output_links_file_path, stpa_ns_uri, mbsa_ns_uri):
    """
    Creates owl:sameAs links between STPA concepts and MBSA items by matching their labels.
    File paths and namespace URIs are provided as arguments.
    """
    # Define namespaces based on the provided arguments
    STPA = Namespace(stpa_ns_uri)
    MBSA = Namespace(mbsa_ns_uri)

    # Load the two source graphs
    print(f"Loading STPA model from: {stpa_file_path}")
    if not os.path.exists(stpa_file_path):
        print(f"!!! ERROR: STPA file not found at '{stpa_file_path}' !!!")
        return
    g_stpa = Graph().parse(stpa_file_path, format="turtle")

    print(f"Loading MBSA vocabulary from: {mbsa_file_path}")
    if not os.path.exists(mbsa_file_path):
        print(f"!!! ERROR: MBSA file not found at '{mbsa_file_path}' !!!")
        return
    g_mbsa = Graph().parse(mbsa_file_path, format="turtle")

    # Create a new graph to store the generated links
    g_links = Graph()
    g_links.bind("stpa", STPA)
    g_links.bind("mbsa", MBSA)
    g_links.bind("owl", OWL)

    # --- Step 1: Find all STPA concepts and their labels ---
    stpa_concepts = {}
    # This query finds instances of Controller, ControlledProcess, or ControlAction and their labels.
    q_stpa = """
        SELECT ?s ?label WHERE { 
            VALUES ?type { stpa:Controller stpa:ControlledProcess stpa:ControlAction }
            ?s a ?type .
            ?s rdfs:label ?label .
        }"""
    for row in g_stpa.query(q_stpa, initNs={'stpa': STPA, 'rdfs': RDFS}):
        # Normalize the label for matching (e.g., lowercase, replace space)
        normalized_label = str(row.label).lower().replace(" ", "_")
        stpa_concepts[normalized_label] = row.s

    print(f"\nFound {len(stpa_concepts)} concepts in STPA model.")
    if not stpa_concepts:
        print("Warning: No STPA concepts found. Check your STPA file or query.")
        print(
            "Ensure your STPA file defines instances of stpa:Controller, stpa:ControlledProcess, or stpa:ControlAction with rdfs:label properties.")

    # --- Step 2: Find all top-level MBSA items and their labels ---
    mbsa_items = {}
    # This query finds AtomicBrickInstances and their rdfs:label
    q_mbsa = """
        SELECT ?s ?label WHERE { 
            ?s rdf:type mbsa:AtomicBrickInstance ;
               rdfs:label ?label .
        }"""
    for row in g_mbsa.query(q_mbsa, initNs={'mbsa': MBSA, 'rdf': RDF, 'rdfs': RDFS}):
        # We only match against top-level components (whose label has no '.')
        if "." not in str(row.label):  # Ensure row.label is treated as a string
            # Normalize the label in the same way as the STPA labels
            normalized_label = str(row.label).lower().replace(" ", "_")
            mbsa_items[normalized_label] = row.s

    print(f"Found {len(mbsa_items)} top-level components in MBSA vocabulary.")
    if not mbsa_items:
        print("Warning: No top-level MBSA items found. Check your MBSA file or query.")

    # --- Step 3: Compare and create owl:sameAs links ---
    links_found = 0
    print("\n--- Creating links ---")
    for norm_label, stpa_uri in stpa_concepts.items():
        if norm_label in mbsa_items:
            mbsa_uri = mbsa_items[norm_label]
            g_links.add((stpa_uri, OWL.sameAs, mbsa_uri))
            links_found += 1
            # .n3() is a handy rdflib function to format URIs for printing
            print(
                f"MATCH: {g_links.namespace_manager.normalizeUri(stpa_uri)} owl:sameAs {g_links.namespace_manager.normalizeUri(mbsa_uri)}")

    # --- Step 4: Save the links to the output file ---
    g_links.serialize(destination=output_links_file_path, format="turtle")
    print(f"\nSUCCESS: {links_found} links created and saved to '{output_links_file_path}'")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Create owl:sameAs links between STPA and MBSA models.")

    parser.add_argument("stpa_file", help="Path to the STPA ontology TTL file.")
    parser.add_argument("mbsa_file", help="Path to the MBSA vocabulary (equipment.ttl) TTL file.")
    parser.add_argument("output_file", help="Path for the output TTL file containing the links.")
    parser.add_argument("stpa_namespace",
                        default="http://www.fd.cvut.cz/chopamax/ontologies/stpa-mbsa#",
                        nargs='?',  # Makes it optional with a default value
                        help="URI of the STPA namespace (default: http://www.fd.cvut.cz/chopamax/ontologies/stpa-mbsa#)")
    parser.add_argument("mbsa_namespace",
                        default="http://fd.cvut.cz/chopamax/mbsa/electrical_system#",
                        nargs='?',  # Makes it optional with a default value
                        help="URI of the MBSA namespace (default: http://fd.cvut.cz/chopamax/mbsa/electrical_system#)")

    args = parser.parse_args()

    print("--- Script Starting ---")
    print(f"STPA File: {args.stpa_file}")
    print(f"MBSA File: {args.mbsa_file}")
    print(f"Output File: {args.output_file}")
    print(f"STPA Namespace: {args.stpa_namespace}")
    print(f"MBSA Namespace: {args.mbsa_namespace}")
    print("-------------------------")

    create_links(args.stpa_file, args.mbsa_file, args.output_file, args.stpa_namespace, args.mbsa_namespace)
