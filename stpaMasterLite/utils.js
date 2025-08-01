const definedControllers = new Set();
const definedControlActions = new Set();
const definedProcesses = new Set();
let scenarioSnippets = [];

const STEP_ONE_MAX_EXPECTED_ROWS = 50;
const STEP_THREE_MAX_EXPECTED_ROWS = 150;
const SLR_MAX_EXPECTED_ROWS = 100;

const LOSS_SCENARIOS_TSV_FILE = "loss-scenarios.tsv";
const LOSS_SCENARIOS_TTL_FILE = "loss-scenarios.ttl";

function exportAllScenariosToTtl() {
  const allMetadata = getAllMetadata();
  definedControllers.clear();
  definedControlActions.clear();
  definedProcesses.clear();
  let controllersBuffer = "";
  let actionsBuffer = "";
  let processesBuffer = "";
  let scenarioSnippets = [];
  let ttlContent = ontologyHeader + "\n";

  for (const scenarioId in allMetadata) {
    const meta = allMetadata[scenarioId];
    const parts = buildLossScenarioParts(
      scenarioId,
      meta.scenarioText,
      meta.controller,
      meta.controlAction,
      meta.controlledProcess,
      meta.context,
      meta.providedStatus,
      meta.feedbackStatus,
      meta.processReceptionStatus,
      meta.processExecutionStatus
    );

    if (!definedControllers.has(parts.controllerId)) {
      definedControllers.add(parts.controllerId);
      controllersBuffer += parts.controllerSnippet + "\n";
    }

    if (!definedControlActions.has(parts.actionId)) {
      definedControlActions.add(parts.actionId);
      actionsBuffer += parts.actionSnippet + "\n";
    }

    if (!definedProcesses.has(parts.processId)) {
      definedProcesses.add(parts.processId);
      processesBuffer += parts.processSnippet + "\n";
    }

    scenarioSnippets.push(
      parts.scenarioSnippet + "\n" +
      parts.scenarioControllerAssocSnippet + "\n" +
      parts.scenarioProcessAssocSnippet + "\n"
    );
  }

  ttlContent += "\n# === Controllers ===\n" + controllersBuffer;
  ttlContent += "\n# === Control Actions ===\n" + actionsBuffer;
  ttlContent += "\n# === Controlled Processes ===\n" + processesBuffer;
  ttlContent += "\n# === Loss Scenarios ===\n";
  for (const snippet of scenarioSnippets) {
    ttlContent += snippet + "\n";
  }

  getOrCreateLossScenariosTtlFile().setContent(ttlContent);
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
    "@prefix : <http://www.fd.cvut.cz/ontologies/stpa-mbsa#> .",
    "@prefix dct: <http://purl.org/dc/terms/> .",
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
    "@prefix xml: <http://www.w3.org/XML/1998/namespace> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
    ""
  ].join("\n");
  return DriveApp.createFile(LOSS_SCENARIOS_TTL_FILE, prefixes);
}

function getOrCreateTtlFile() {
  const files = DriveApp.getFilesByName(ONTOLOGY_FILE_NAME);
  if (files.hasNext()) {
    const file = files.next();
    return file;
  }
  const newFile = DriveApp.createFile(ONTOLOGY_FILE_NAME, "");
  return newFile;
}

function appendToLossScenariosTtlFile(text) {
  const file = getOrCreateLossScenariosTtlFile();
  const oldContent = file.getBlob().getDataAsString();
  file.setContent(oldContent + "\n" + text);
}

function generateLossScenarioTtlSnippet(
  scenarioId,
  scenarioText,
  controller,
  controlAction,
  controlledProcess,
  context,
  providedStatus,
  feedbackStatus
) {
  const sanitizedScenarioId = scenarioId?.replace(/[^\w-]/g, "_");
  const sanitizedControllerId = controller?.replace(/[^\w-]/g, "_");

  const typeMatch = sanitizedScenarioId.match(/LS-\d+_(\d+)/);
  const scenarioClass = typeMatch ? typeMatch[1] : "UnknownType";

  const participationId = `${sanitizedScenarioId}--${sanitizedControllerId}-Participation`;

  const scenarioSnippet = `
:${sanitizedScenarioId} a :LossScenario ;
    :scenario-class "${scenarioClass}" ;
    :original-text "${scenarioText}" ;
    :has-control-action :${controlAction.replace(/[^\w-]/g, "_")} ;
    :has-controlled-process :${controlledProcess.replace(/[^\w-]/g, "_")} ;
    :context "${context || ""}" .
`;

  const participationSnippet = `
:${participationId} a :ScenarioControllerParticipation ;
    :in-scenario :${sanitizedScenarioId} ;
    :has-controller :${sanitizedControllerId} ;
    :provided-status "${providedStatus || ""}" ;
    :feedback-status "${feedbackStatus || ""}" .
`;

  let controllerSnippet = "";
  if (!definedControllers.has(sanitizedControllerId)) {
    controllerSnippet = `
:${sanitizedControllerId} a :Controller ;
    rdfs:label "${controller}" .
`;
    definedControllers.add(sanitizedControllerId);
  }

  let controlActionSnippet = "";
  const sanitizedCa = controlAction.replace(/[^\w-]/g, "_");
  if (!definedControllers.has(sanitizedCa)) {
    controlActionSnippet = `
:${sanitizedCa} a :ControlAction ;
    rdfs:label "${controlAction}" .
`;
    definedControllers.add(sanitizedCa);
  }

  let controlledProcessSnippet = "";
  const sanitizedCp = controlledProcess.replace(/[^\w-]/g, "_");
  if (!definedControllers.has(sanitizedCp)) {
    controlledProcessSnippet = `
:${sanitizedCp} a :ControlledProcess ;
    rdfs:label "${controlledProcess}" .
`;
    definedControllers.add(sanitizedCp);
  }

  return (
    scenarioSnippet +
    participationSnippet +
    controllerSnippet +
    controlActionSnippet +
    controlledProcessSnippet
  );
}

function buildLossScenarioParts(
  scenarioId,
  scenarioText,
  controller,
  controlAction,
  controlledProcess,
  context,
  providedStatus,
  feedbackStatus,
  processReceptionStatus,
  processExecutionStatus
) {
  const sanitizedScenarioId = scenarioId.replace(/[^\w-]/g, "_");
  const sanitizedControllerId = controller.replace(/[^\w-]/g, "_");
  const sanitizedActionId = controlAction.replace(/[^\w-]/g, "_");
  const sanitizedProcessId = controlledProcess.replace(/[^\w-]/g, "_");

  const typeMatch = sanitizedScenarioId.match(/LS-\d+_(\d+)/);
  const scenarioClass = typeMatch ? typeMatch[1] : "UnknownType";

  const controllerAssociationId =
    `${sanitizedScenarioId}--${sanitizedControllerId}-association`;

  const processAssociationId =
    `${sanitizedScenarioId}--${sanitizedProcessId}-association`;

  const controllerSnippet = `
stpa:${sanitizedControllerId} a stpa:Controller ;
    rdfs:label "${controller}" .
`;

  const actionSnippet = `
stpa:${sanitizedActionId} a stpa:ControlAction ;
    rdfs:label "${controlAction}" .
`;

  const processSnippet = `
stpa:${sanitizedProcessId} a stpa:ControlledProcess ;
    rdfs:label "${controlledProcess}" .
`;

  const scenarioSnippet = `
stpa:${sanitizedScenarioId} a stpa:LossScenario ;
    stpa:scenario-class "${scenarioClass}" ;
    stpa:original-text "${scenarioText}" ;
    stpa:has-control-action stpa:${sanitizedActionId} ;
    stpa:has-controlled-process stpa:${sanitizedProcessId} ;
    stpa:context "${context || ""}" .
`;

  const scenarioControllerAssocSnippet = `
stpa:${controllerAssociationId} a stpa:ScenarioControllerAssociation ;
    stpa:belongs-to-scenario stpa:${sanitizedScenarioId} ;
    stpa:has-controller stpa:${sanitizedControllerId} ;
    stpa:provided-status "${providedStatus || ""}" ;
    stpa:feedback-status "${feedbackStatus || ""}" .
`;

  const scenarioProcessAssocSnippet = `
stpa:${processAssociationId} a stpa:ScenarioProcessAssociation ;
    stpa:belongs-to-scenario stpa:${sanitizedScenarioId} ;
    stpa:has-process stpa:${sanitizedProcessId} ;
    stpa:process-reception-status "${processReceptionStatus || ""}" ;
    stpa:process-execution-status "${processExecutionStatus || ""}" .
`;

  return {
    controllerId: sanitizedControllerId,
    controllerSnippet,
    actionId: sanitizedActionId,
    actionSnippet,
    processId: sanitizedProcessId,
    processSnippet,
    scenarioSnippet,
    scenarioControllerAssocSnippet,
    scenarioProcessAssocSnippet
  };
}

