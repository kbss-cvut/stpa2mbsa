import rdflib
import hashlib
import re
import sys

NS_MYONTO = "http://a.ontology/myonto#"
NS_TERMIT = "http://onto.fel.cvut.cz/ontologies/application/termit/pojem/"

ORIGINAL_TEXT_URI_STPA = rdflib.URIRef(NS_MYONTO + "has-original-text")
ORIGINAL_TEXT_URI_RELIABILITY = rdflib.URIRef(
    "http://onto.fel.cvut.cz/ontologies/application/termit/pojem/odkazuje-na-anotovaný-text")
ORIGINAL_TEXT_PREDICATES = [ORIGINAL_TEXT_URI_STPA, ORIGINAL_TEXT_URI_RELIABILITY]

ORIGINAL_TEXT_ID_PROPERTY = rdflib.URIRef(NS_MYONTO + "originalTextID")


def normalize_text(text):
    text_no_html = re.sub(r'<[^>]+>', '', text)
    normalized = ' '.join(text_no_html.lower().split())
    normalized = re.sub(r'\(\s+', '(', normalized)
    normalized = re.sub(r'\s+\)', ')', normalized)
    return normalized


def compute_hash(text):
    normalized = normalize_text(text)
    hash_value = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    return hash_value, normalized


def add_original_text_id(graph, original_text_predicates, id_property, file_label):
    for pred in original_text_predicates:
        for s, p, o in graph.triples((None, pred, None)):
            if isinstance(o, rdflib.Literal):
                raw_text = str(o)
                hash_value, normalized = compute_hash(raw_text)
                graph.add((s, id_property, rdflib.Literal(hash_value)))


def main():
    if len(sys.argv) != 4:
        print("Usage: python merge_stpa_reliability.py reliability.ttl stpa.ttl output.ttl")
        sys.exit(1)

    reliability_file = sys.argv[1]
    stpa_file = sys.argv[2]
    output_file = sys.argv[3]

    g_reliability = rdflib.Graph()
    g_reliability.parse(reliability_file, format="turtle")

    g_stpa = rdflib.Graph()
    g_stpa.parse(stpa_file, format="turtle")
    add_original_text_id(g_reliability, ORIGINAL_TEXT_PREDICATES, ORIGINAL_TEXT_ID_PROPERTY, "Reliability")
    add_original_text_id(g_stpa, ORIGINAL_TEXT_PREDICATES, ORIGINAL_TEXT_ID_PROPERTY, "STPA")
    merged_graph = g_reliability + g_stpa
    merged_graph.serialize(destination=output_file, format="turtle")


if __name__ == "__main__":
    main()
