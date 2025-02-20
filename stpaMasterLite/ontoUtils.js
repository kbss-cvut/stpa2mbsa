const LOSS_SCENARIOS_TTL_FILE = "loss-scenarios.ttl";

function getOrCreateLossScenariosTtlFile() {
  const files = DriveApp.getFilesByName(LOSS_SCENARIOS_TTL_FILE);
  if (files.hasNext()) {
    return files.next();
  }
  const prefixes = [
    "@prefix : <http://a.ontology/myonto#> .",
    "@prefix dct: <http://purl.org/dc/terms/> .",
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
    "@prefix xml: <http://www.w3.org/XML/1998/namespace> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
    "@base <http://www.fd.cvut.cz/ontologies/stpa-mbsa#> .",
    "",
  ].join("\n");
  return DriveApp.createFile(LOSS_SCENARIOS_TTL_FILE, prefixes);
}

function getOrCreateTtlFile() {
  const files = DriveApp.getFilesByName(ONTOLOGY_FILE_NAME);
  if (files.hasNext()) {
    const file = files.next();
    ensurePrefixes();
    return file;
  }
  const newFile = DriveApp.createFile(ONTOLOGY_FILE_NAME, "");
  ensurePrefixes();
  return newFile;
}

function appendToLossScenariosTtlFile(text) {
  const file = getOrCreateLossScenariosTtlFile();
  const oldContent = file.getBlob().getDataAsString();
  file.setContent(oldContent + "\n" + text);
}

function generateLossScenarioTtlSnippet(scenarioId, controller, controlAction, controlledProcess, context) {
  const ontoScenarioId = scenarioId?.replace(/[^\w-]/g, "_");
  const ontoController = controller?.replace(/\s+/g, "_");
  const ontoControlAction = controlAction?.replace(/\s+/g, "_");
  const ontoControlledProcess = controlledProcess?.replace(/\s+/g, "_");
  const typeMatch = ontoScenarioId.match(/LS-\d+_(\d+)/);
  const type = typeMatch ? typeMatch[1] : "UnknownType";

  const ttlSnippet = `
:${ontoScenarioId} a :LossScenario ;
    :has_type :${type} ;
    :has_controller :${ontoController} ;
    :has_control_action :${ontoControlAction} ;
    :has_controlled_process :${ontoControlledProcess} ;
    :has_context "${context || ''}" .
`;
  return ttlSnippet;
}