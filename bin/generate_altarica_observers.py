# Update the script to remove the unnecessary ".Context" suffix from the controlled process variable in the generated predicates.
import json
import argparse
from collections import defaultdict
from pathlib import Path
import re

# === Argument Parsing ===
parser = argparse.ArgumentParser(description="Generate MBSA observers from STPA SPARQL results")
parser.add_argument("--input", required=True, help="Input SPARQL result file (.srj or .json)")
parser.add_argument("--output", required=True, help="Output folder to store mbsa_observers.txt")
args = parser.parse_args()

input_path = Path(args.input)
output_folder = Path(args.output)
output_path = output_folder / "mbsa_observers.txt"

# === Load SPARQL JSON Result ===
with open(input_path, "r", encoding="utf-8") as f:
    data = json.load(f)

def norm(s):
    return s.lower().strip()

# === Group data ===
scenarios = defaultdict(lambda: {
    "controller": None,
    "controllerLabel": None,
    "controlAction": None,
    "controlActionLabel": None,
    "controlledProcess": None,
    "controlledProcessLabel": None,
    "feedback": None,
    "feedbackLabel": None,
    "context": None,
    "providedStatus": None,
    "feedbackStatus": None,
    "processReceptionStatus": None,
    "processExecutionStatus": None,
    "scenarioID": None,
    "annotations": []
})

for binding in data["results"]["bindings"]:
    sid = binding["lossID"]["value"]
    s = scenarios[sid]
    s["scenarioID"] = sid

    s["controller"] = binding["controller"]["value"].split("#")[-1]
    s["controllerLabel"] = binding.get("controllerLabel", {}).get("value", "")
    s["controlAction"] = binding["controlAction"]["value"].split("#")[-1]
    s["controlActionLabel"] = binding.get("controlActionLabel", {}).get("value", "")
    s["controlledProcess"] = binding["controlledProcess"]["value"].split("#")[-1]
    s["controlledProcessLabel"] = binding.get("controlledProcessLabel", {}).get("value", "")
    s["feedback"] = binding["feedback"]["value"].split("#")[-1]
    s["feedbackLabel"] = binding.get("feedbackLabel", {}).get("value", "")
    s["context"] = binding["context"]["value"]
    s["providedStatus"] = binding["providedStatus"]["value"]
    s["feedbackStatus"] = binding["feedbackStatus"]["value"]
    s["processReceptionStatus"] = binding["processReceptionStatus"]["value"]
    s["processExecutionStatus"] = binding["processExecutionStatus"]["value"]

    exactText = binding["exactText"]["value"]
    mbsaTerm = binding["MBSATerm"]["value"].split("/")[-1]
    s["annotations"].append((norm(exactText), mbsaTerm))

def resolve_roles(sdata):
    resolved = {
        "controlAction": None,
        "feedback": None,
        "controlledProcess": None
    }
    label_map = {
        "controlAction": norm(sdata["controlActionLabel"]),
        "feedback": norm(sdata["feedbackLabel"]),
        "controlledProcess": norm(sdata["controlledProcessLabel"])
    }

    context_norm = norm(sdata["context"])

    for exact, term in sdata["annotations"]:
        for role, label in label_map.items():
            if label and (label == exact or label in exact or exact in label):
                resolved[role] = term

    for exact, term in sdata["annotations"]:
        if exact in context_norm or context_norm in exact:
            resolved["controlledProcess"] = term
            break

    return resolved

def parse_class_and_uca(scenario_id):
    match = re.match(r"LS-(\d+)_(\d+)", scenario_id)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None, None

def generate_observer(sid, sdata):
    fallback = lambda x: f'"{x}"'
    resolved = resolve_roles(sdata)

    ca = resolved["controlAction"] or sdata["controlAction"]
    fb = resolved["feedback"] or sdata["feedback"]
    cp = resolved["controlledProcess"] or sdata["controlledProcess"]

    ps = fallback(sdata["providedStatus"])
    fs = "nominal" if sdata["feedbackStatus"] == "accurate" else "inaccurate"
    prs = fallback(sdata["processReceptionStatus"])
    pes = fallback(sdata["processExecutionStatus"])
    ctx = "true"

    scenario_class, uca_type = parse_class_and_uca(sdata["scenarioID"])

    if scenario_class == 1 and uca_type == 1:
        return f"""predicate {sid} = <term(
  {ca} = {ps} and
  {fb} = {fs} and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 1 and uca_type == 2:
        return f"""predicate {sid} = <term(
  {ca} = "provided" and
  {fb} = {fs} and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 1 and uca_type == 3:
        return f"""predicate {sid} = <term(
  {ca} in {{"providedTooEarly", "providedTooLate"}} and
  {fb} = {fs} and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 1 and uca_type == 4:
        return f"""predicate {sid} = <term(
  {ca} in {{"providedWithTooShortDuration", "providedWithTooLongDuration"}} and
  {fb} = {fs} and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 2:
        return f"""predicate {sid} = <term(
  {fb} = inaccurate and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 3 and uca_type == 1:
        return f"""predicate {sid} = <term(
  {ca} = "notProvided" and
  {cp}.ControllerInput in {{"received", "receivedTooEarly", "receivedTooLate"}} and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 3 and uca_type in {2, 3}:
        return f"""predicate {sid} = <term(
  {ca} in {{"provided", "providedTooEarly", "providedTooLate"}} and
  {cp}.ControllerInput = "notReceived" and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 3 and uca_type == 4:
        return f"""predicate {sid} = <term(
  {ca} = "provided" and
  {cp}.ControllerInput = "receivedWithInnapropriateDuration" and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 4 and uca_type == 1:
        return f"""predicate {sid} = <term(
  {cp}.ControllerInput = "notReceived" and
  {cp}.state in {{"executed", "executedTooEarly", "executedTooLate"}} and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 4 and uca_type in {2, 3}:
        return f"""predicate {sid} = <term(
  {cp}.ControllerInput in {{"received", "receivedTooEarly", "receivedTooLate"}} and
  {cp}.state = "notExecuted" and
  {cp} = {ctx}
)>;"""
    elif scenario_class == 4 and uca_type == 4:
        return f"""predicate {sid} = <term(
  {cp}.ControllerInput = "receivedWithInnapropriateDuration" and
  {cp}.state = "notExecuted" and
  {cp} = {ctx}
)>;"""
    else:
        return f"// Unknown scenario pattern for {sid}"

output_folder.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", encoding="utf-8") as out:
    for sid, sdata in scenarios.items():
        observer = generate_observer(sid, sdata)
        out.write(observer + "\n\n")

print(f"✅ Observers saved to {output_path}")
