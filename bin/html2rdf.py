#!/usr/bin/env python3
import sys
from bs4 import BeautifulSoup
import html

if len(sys.argv) != 3:
    print("Usage: {} input.html output.ttl".format(sys.argv[0]))
    sys.exit(1)

input_html = sys.argv[1]
output_ttl = sys.argv[2]

instance_base = "http://onto.fel.cvut.cz/ontologies/application/termit/pojem/výskyt-termu/instance"
term_type = "<http://onto.fel.cvut.cz/ontologies/application/termit/pojem/výskyt-termu>"
assign_prop = "<http://onto.fel.cvut.cz/ontologies/application/termit/pojem/je-přiřazením-termu>"
anno_prop = "<http://onto.fel.cvut.cz/ontologies/application/termit/pojem/odkazuje-na-anotaci>"
text_prop = "<http://onto.fel.cvut.cz/ontologies/application/termit/pojem/odkazuje-na-anotovaný-text>"

with open(input_html, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

spans = soup.find_all("span", attrs={"property": "ddo:je-výskytem-termu"})

turtle_blocks = []

for span in spans:
    about = span.get("about")
    if not about:
        continue
    ident = about.replace("_:", "")
    instance_iri = f"<{instance_base}{ident}>"

    resource = span.get("resource")
    if resource:
        resource_iri = f"<{resource}>"
    else:
        literal = span.get("content", "").strip()
        resource_iri = f"\"{literal}\""

    original_annotation = html.escape(str(span))
    annotated_text = html.escape(span.get_text().strip())

    block = f"""{instance_iri}
    a {term_type} ;
    {assign_prop} {resource_iri} ;
    {anno_prop} "{original_annotation}" ;
    {text_prop} "{annotated_text}" .
"""
    turtle_blocks.append(block)

with open(output_ttl, "w", encoding="utf-8") as f_out:
    # Write prefix declarations (adjust these if needed)
    f_out.write("""@prefix termit: <http://onto.fel.cvut.cz/ontologies/application/termit/pojem/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

""")
    for block in turtle_blocks:
        f_out.write(block + "\n")

print(f"Conversion complete. RDF written to {output_ttl}.")
