import json
import sys
import os

def generate_altarica_predicates(input_altarica_filepath, input_json_filepath, target_node_name):
    if not os.path.exists(input_altarica_filepath):
        print(f"Error: ALtaRica file '{input_altarica_filepath}' not found.")
        return
    if not os.path.exists(input_json_filepath):
        print(f"Error: JSON file '{input_json_filepath}' not found.")
        return
    if not target_node_name:
        print("Error: Target node name cannot be empty.")
        return

    try:
        with open(input_json_filepath, 'r') as f:
            json_data = json.load(f)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in '{input_json_filepath}'.")
        return
    except Exception as e:
        print(f"Error reading JSON '{input_json_filepath}': {e}")
        return

    new_predicates = []
    if 'results' in json_data and 'bindings' in json_data['results']:
        for item in json_data['results']['bindings']:
            scenario_name = item['scenarioName']['value']
            conditions_str = item['allConditions']['value']
            altarica_label = scenario_name.replace('.', '_').replace('-', '_')
            predicate_line = f"\tpredicate {altarica_label} = <term(({conditions_str}))>;"
            new_predicates.append(predicate_line)

    try:
        with open(input_altarica_filepath, 'r') as f:
            altarica_lines = f.readlines()
    except Exception as e:
        print(f"Error reading ALtaRica file '{input_altarica_filepath}': {e}")
        return

    modified_altarica_lines = []
    node_stack = []
    insertion_index = -1
    found_target_node_start = False

    for i, line in enumerate(altarica_lines):
        stripped_line = line.strip()

        if stripped_line.startswith("node "):
            node_name_parts = stripped_line.split("node ", 1)[1].split(' ', 1)
            node_name = node_name_parts[0].strip()
            node_stack.append((node_name, i))
            if node_name == target_node_name and not found_target_node_start:
                found_target_node_start = True

        elif stripped_line == "edon":
            if node_stack:
                last_node_name, last_node_start_index = node_stack.pop()
                if last_node_name == target_node_name and found_target_node_start:
                    insertion_index = i
                    break

    insertion_success = False
    if insertion_index != -1 and new_predicates:
        modified_altarica_lines.extend(altarica_lines[:insertion_index])
        modified_altarica_lines.append("\n\t-- Safety Predicates from STPA/JSON --\n")
        modified_altarica_lines.extend([p + "\n" for p in new_predicates])
        modified_altarica_lines.append("\n")
        modified_altarica_lines.extend(altarica_lines[insertion_index:])
        insertion_success = True
    else:
        modified_altarica_lines = altarica_lines

    base_name, ext = os.path.splitext(input_altarica_filepath)
    if insertion_success:
        output_altarica_filepath = f"{base_name}_with_predicates{ext}"
    else:
        output_altarica_filepath = f"{base_name}_no_new_assertions_injected{ext}"

    try:
        with open(output_altarica_filepath, 'w') as f:
            f.writelines(modified_altarica_lines)

        if insertion_success:
            print(f"Successfully generated '{output_altarica_filepath}' with new predicates.")
        else:
            if not new_predicates:
                print(f"No new predicates were generated from JSON. Output copied to '{output_altarica_filepath}'.")
            else:
                print(f"Warning: Node '{target_node_name}' not found or 'edon' boundary not correctly identified. Output copied to '{output_altarica_filepath}' without new predicates.")

    except Exception as e:
        print(f"Error writing to '{output_altarica_filepath}': {e}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python inject_altarica_predicates.py <input_altarica_file> <input_json_file> <target_node_name>")
        sys.exit(1)

    altarica_file = sys.argv[1]
    json_file = sys.argv[2]
    target_node = sys.argv[3]

    generate_altarica_predicates(altarica_file, json_file, target_node)
