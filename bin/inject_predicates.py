import json
import sys
import os


def generate_altarica_predicates(input_altarica_filepath, input_json_filepath, target_node_name, output_dir=None):
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

    if not new_predicates:
        print("Info: No new predicates generated from JSON data.")

    try:
        with open(input_altarica_filepath, 'r') as f:
            altarica_lines = f.readlines()
    except Exception as e:
        print(f"Error reading ALtaRica file '{input_altarica_filepath}': {e}")
        return

    final_altarica_lines = []
    insertion_successful = False

    node_depth = 0
    in_target_node = False
    target_node_start_line = -1
    target_node_edon_line = -1
    extern_line_in_target_node = -1
    node_indentation = ""

    for i, line in enumerate(altarica_lines):
        stripped_line = line.strip()

        if stripped_line.startswith("node "):
            node_name_parts = stripped_line.split("node ", 1)[1].split(' ', 1)
            current_node_name = node_name_parts[0].strip()
            node_depth += 1
            if current_node_name == target_node_name and not in_target_node:
                in_target_node = True
                target_node_start_line = i
                node_indentation = line.split("node ")[0]

        elif stripped_line == "edon":
            node_depth -= 1
            if in_target_node and node_depth == altarica_lines[target_node_start_line].count('node ') - 1:
                target_node_edon_line = i
                break

        if in_target_node and i > target_node_start_line and extern_line_in_target_node == -1:
            if stripped_line == "extern":
                extern_line_in_target_node = i

    if target_node_start_line != -1 and target_node_edon_line != -1 and new_predicates:
        insertion_point_found = False

        for i, line in enumerate(altarica_lines):
            final_altarica_lines.append(line)

            if i == target_node_edon_line - 1 and extern_line_in_target_node == -1:
                if not insertion_point_found:
                    final_altarica_lines.append(node_indentation + "  extern\n")
                    final_altarica_lines.extend([p + "\n" for p in new_predicates])
                    insertion_successful = True
                    insertion_point_found = True
            elif i == extern_line_in_target_node:
                if not insertion_point_found:
                    final_altarica_lines.extend([p + "\n" for p in new_predicates])
                    insertion_successful = True
                    insertion_point_found = True
    else:
        final_altarica_lines = altarica_lines
        if target_node_start_line == -1 or target_node_edon_line == -1:
            print(f"Error: Target node '{target_node_name}' not found in ALtaRica file.")

    base_name, ext = os.path.splitext(os.path.basename(input_altarica_filepath))

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        output_altarica_filename = f"{base_name}_with_predicates{ext}" if insertion_successful else f"{base_name}_no_new_predicates{ext}"
        output_altarica_filepath = os.path.join(output_dir, output_altarica_filename)
    else:
        output_altarica_filename = f"{base_name}_with_predicates{ext}" if insertion_successful else f"{base_name}_no_new_predicates{ext}"
        output_altarica_filepath = os.path.join(os.path.dirname(input_altarica_filepath), output_altarica_filename)

    try:
        with open(output_altarica_filepath, 'w') as f:
            f.writelines(final_altarica_lines)

        if insertion_successful:
            print(f"Successfully generated '{output_altarica_filepath}' with new predicates.")
        else:
            if not new_predicates:
                print(f"No new predicates were generated from JSON. Output copied to '{output_altarica_filepath}'.")
            else:
                print(
                    f"Warning: Node '{target_node_name}' not found or 'edon' boundary not correctly identified. Output copied to '{output_altarica_filepath}' without new predicates.")

    except Exception as e:
        print(f"Error writing to '{output_altarica_filepath}': {e}")

if __name__ == "__main__":
    if len(sys.argv) < 4 or len(sys.argv) > 5:
        print(
            "Usage: python inject_altarica_predicates.py <input_altarica_file> <input_json_file> <target_node_name> [output_directory]")
        sys.exit(1)

    altarica_file = sys.argv[1]
    json_file = sys.argv[2]
    target_node = sys.argv[3]
    output_dir = sys.argv[4] if len(sys.argv) == 5 else None

    generate_altarica_predicates(altarica_file, json_file, target_node, output_dir)
