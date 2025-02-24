const NON_EDITABLE_BACKGROUND = "#efefef";
const WHITE_BACKGROUND = "#ffffff";

const STEP_ONE_MAX_EXPECTED_ROWS = 50;
const STEP_THREE_MAX_EXPECTED_ROWS = 150;
const SLR_MAX_EXPECTED_ROWS = 100;

const LOSS_SCENARIOS_TSV_FILE = "LossScenarios.tsv";
const LOSS_SCENARIOS_TTL_FILE = "loss-scenarios.ttl";

function exportAllMetadataToLossScenariosTtl() {
  const allMetadata = getAllMetadata();

  for (const scenarioId in allMetadata) {
    const meta = allMetadata[scenarioId];
    const ttlSnippet = generateLossScenarioTtlSnippet(
      scenarioId,
      meta.controller,
      meta.controlAction,
      meta.controlledProcess,
      meta.context
    );
    appendToLossScenariosTtlFile(ttlSnippet);
  }

  SpreadsheetApp.getUi().alert("Exported all loss scenarios to " + LOSS_SCENARIOS_TTL_FILE + "!");
}

function exportAllMetadataToLossScenariosTtlFlat() {
  const allMetadata = getAllMetadata();

  for (const scenarioId in allMetadata) {
    const meta = allMetadata[scenarioId];
    const ttlSnippet = generateLossScenarioTtlSnippetFlat(
      scenarioId,
      meta.controller,
      meta.controlAction,
      meta.controlledProcess,
      meta.context
    );
    appendToLossScenariosTtlFile(ttlSnippet);
  }

  SpreadsheetApp.getUi().alert("Exported all loss scenarios to " + LOSS_SCENARIOS_TTL_FILE + "!");
}

function exportLossScenariosToTsv() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(LOSS_SCENARIOS_SHEET_NAME);
  const ucas = sheet.getRange(`A${LOSS_SCENARIOS_HEADER_ROWS + 1}:A`).getValues();
  const lastRow = ucas.filter(String).length + LOSS_SCENARIOS_HEADER_ROWS;
  const range = sheet.getRange(LOSS_SCENARIOS_HEADER_ROWS + 1, LOSS_SCENARIO_TYPE_ONE_COLUMN, lastRow - LOSS_SCENARIOS_HEADER_ROWS, 4);
  const lossScenarios = range.getValues().flatMap(row => row.filter(cell => cell.length > 0));

  let tsvContent = "scenario\n";

  lossScenarios.forEach(scenario => {
    tsvContent += `${scenario}\n`;
  });

  const tsvFile = getOrCreateTsvFile();
  tsvFile.setContent(tsvContent);

  SpreadsheetApp.getUi().alert("Exported all loss scenarios to " + LOSS_SCENARIOS_TSV_FILE + "!");
}

function getOrCreateTsvFile() {
  const files = DriveApp.getFilesByName(LOSS_SCENARIOS_TSV_FILE);
  if (files.hasNext()) {
    return files.next();
  }
  return DriveApp.createFile(LOSS_SCENARIOS_TSV_FILE, "");
}

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

function generateLossScenarioTtlSnippetFlat(scenarioId, controller, controlAction, controlledProcess, context) {
  const base = "http://www.fd.cvut.cz/ontologies/stpa-mbsa";

  const ontoScenarioId = scenarioId?.replace(/[^\w-]/g, "_");
  const ontoController = controller?.replace(/\s+/g, "_");
  const ontoControlAction = controlAction?.replace(/\s+/g, "_");
  const ontoControlledProcess = controlledProcess?.replace(/\s+/g, "_");
  const typeMatch = ontoScenarioId.match(/LS-\d+_(\d+)/);
  const type = typeMatch ? typeMatch[1] : "UnknownType";

  const ttlSnippet = `
<${base}#${ontoScenarioId}> a <${base}#LossScenario> ;
    <${base}#has_type> <${base}#${type}> ;
    <${base}#has_controller> <${base}#${ontoController}> ;
    <${base}#has_control_action> <${base}#${ontoControlAction}> ;
    <${base}#has_controlled_process> <${base}#${ontoControlledProcess}> ;
    <${base}#has_context> "${context || ''}" .
`;
  return ttlSnippet;
}

