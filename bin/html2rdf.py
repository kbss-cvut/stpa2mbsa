import sys
import re
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
scenarioID_prop = "termit:scenarioID"

scenario_regex = re.compile(r'\((LS-[^)]+)\)')


def escape_for_turtle_literal(text, is_html_content=False):
    if is_html_content:
        text = html.escape(text)

    text = text.replace('\\', '\\\\')
    text = text.replace('"', '\\"')
    text = text.replace('\n', '\\n')
    text = text.replace('\r', '')
    return text


with open(input_html, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

full_property_uri = "http://onto.fel.cvut.cz/ontologies/application/termit/pojem/je-výskytem-termu"
spans = soup.find_all("span", attrs={"property": full_property_uri})

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
        literal = span.get("content")
        if not literal:
            literal = span.get_text().strip()

        resource_iri = f"\"{escape_for_turtle_literal(literal)}\""

    original_annotation = escape_for_turtle_literal(str(span), is_html_content=True)
    annotated_text = escape_for_turtle_literal(span.get_text().strip())

    parent_p = span.find_parent("p")
    scenario_id = ""
    if parent_p:
        parent_text = parent_p.get_text()
        match = scenario_regex.search(parent_text)
        if match:
            scenario_id = match.group(1)

    if not scenario_id:
        continue

    block = f"""{instance_iri}
    a {term_type} ;
    {assign_prop} {resource_iri} ;
    {anno_prop} \"{original_annotation}\" ;
    {text_prop} \"{annotated_text}\" ;
    {scenarioID_prop} \"{scenario_id}\" .
"""
    turtle_blocks.append(block)

with open(output_ttl, "w", encoding="utf-8") as f_out:
    f_out.write("""@prefix termit: <http://onto.fel.cvut.cz/ontologies/application/termit/pojem/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

""")
    for block in turtle_blocks:
        f_out.write(block + "\n")

print(f"Conversion complete. RDF written to {output_ttl}.")
