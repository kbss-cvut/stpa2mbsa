import pandas as pd
import os
import re
import sys
from collections import defaultdict

# Constants
MY_PREFIX_LABEL = "mbsa"
MY_NAMESPACE = "http://fd.cvut.cz/chopamax/mbsa/aida"
MY_PREFIX_DECL = f"@prefix {MY_PREFIX_LABEL}: <{MY_NAMESPACE}> .\n"
RDF_PREFIX = "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n"
OWL_PREFIX = "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n"
RDFS_PREFIX = "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n"
SKOS_PREFIX = "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n\n"
ONTOLOGY_HEADER = (
    f"{MY_PREFIX_LABEL}: rdf:type owl:Ontology ;\n"
    f"    owl:versionIRI {MY_PREFIX_LABEL}:v0.1 .\n\n"
)

def make_uri_safe(text):
    text = re.sub(r'\s+', '_', text)
    text = re.sub(r'[^a-zA-Z0-9_]', '', text)
    return text

def extract_deepest_paths(df):
    occurrences = defaultdict(list)
    for _, row in df.iterrows():
        name = str(row["Name"]).strip() if pd.notna(row["Name"]) else ""
        parent = str(row["Parent"]).strip() if pd.notna(row["Parent"]) else ""
        if not name:
            continue
        path = f"{parent}.{name}" if parent else name
        depth = path.count(".")
        occurrences[name].append((depth, path))
    return {name: max(paths, key=lambda x: x[0])[1] for name, paths in occurrences.items()}

def generate_ttl_with_full_path(excel_path, ttl_path):
    df = pd.read_excel(excel_path, header=None, names=["Nature", "Parent", "Name"], usecols=[1, 2, 3])
    full_paths = extract_deepest_paths(df)

    output_dir = os.path.dirname(ttl_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    with open(ttl_path, "w", encoding="utf-8") as f:
        f.write(MY_PREFIX_DECL)
        f.write(RDF_PREFIX)
        f.write(OWL_PREFIX)
        f.write(RDFS_PREFIX)
        f.write(SKOS_PREFIX)
        f.write(ONTOLOGY_HEADER)

        for index, row in df.iterrows():
            nature = str(row["Nature"]).strip() if pd.notna(row["Nature"]) else ""
            parent = str(row["Parent"]).strip() if pd.notna(row["Parent"]) else ""
            name = str(row["Name"]).strip() if pd.notna(row["Name"]) else ""
            if not name:
                continue

            name_uri = make_uri_safe(name)
            parent_uri = make_uri_safe(parent) if parent else ""
            full_path = full_paths.get(name, name)

            f.write(f"{MY_PREFIX_LABEL}:{name_uri} rdf:type owl:Class ;\n")
            f.write(f"    rdfs:label \"{full_path}\" ;\n")
            f.write(f"    {MY_PREFIX_LABEL}:nature \"{nature}\" ;\n")

            if nature in ["InConnector", "OutConnector", "AtomicBrickInstance",
                          "CompositeBrickInstance", "Event", "StateVariable", "Value"]:
                f.write(f"    rdfs:subClassOf {MY_PREFIX_LABEL}:{make_uri_safe(nature)} ;\n")

            if parent_uri:
                f.write(f"    {MY_PREFIX_LABEL}:belongsTo {MY_PREFIX_LABEL}:{parent_uri} ;\n")

            f.write("    .\n\n")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python generate_equipment_ttl.py <input_excel_file> <output_ttl_file>")
        sys.exit(1)

    input_excel = sys.argv[1]
    output_ttl = sys.argv[2]
    generate_ttl_with_full_path(input_excel, output_ttl)
    print(f"TTL file written to: {output_ttl}")
