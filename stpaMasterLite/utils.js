const definedControllers = new Set();
const definedControlActions = new Set();
const definedProcesses = new Set();
const definedFeedbacks = new Set();
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
  definedFeedbacks.clear();
  let controllersBuffer = "";
  let actionsBuffer = "";
  let processesBuffer = "";
  let feedbackBuffer = "";
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
      meta.feedback,
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

    if (meta.feedback && meta.feedback.trim() !== "" && meta.feedback.trim().toLowerCase() !== "n/a") {
      const fbId = meta.feedback.replace(/[^\w-]/g, "_");
      if (!definedFeedbacks.has(fbId)) {
        definedFeedbacks.add(fbId);
        feedbackBuffer += `\nstpa:${fbId} a stpa:Feedback ;\n    rdfs:label "${meta.feedback}" .\n`;
      }
    }

    scenarioSnippets.push(
      parts.scenarioSnippet + "\n" +
      parts.scenarioControllerAssocSnippet + "\n" +
      parts.scenarioControlActionAssocSnippet + "\n" +
      parts.scenarioFeedbackAssocSnippet + "\n" +
      parts.scenarioProcessAssocSnippet + "\n"
    );
  }

  ttlContent += "\n# === Controllers ===\n" + controllersBuffer;
  ttlContent += "\n# === Control Actions ===\n" + actionsBuffer;
  ttlContent += "\n# === Controlled Processes ===\n" + processesBuffer;
  ttlContent += "\n# === Feedbacks ===\n" + feedbackBuffer;
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

  return DriveApp.createFile(LOSS_SCENARIOS_TTL_FILE, "");
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
  feedbackStatus,
  feedback,
  processReceptionStatus,
  processExecutionStatus
) {
  const sanitizedScenarioId = scenarioId?.replace(/[^\w-]/g, "_");
  const sanitizedControllerId = controller?.replace(/[^\w-]/g, "_");
  const sanitizedActionId = controlAction?.replace(/[^\w-]/g, "_");
  const sanitizedProcessId = controlledProcess?.replace(/[^\w-]/g, "_");
  const sanitizedFeedbackId = feedback?.replace(/[^\w-]/g, "_");

  const typeMatch = sanitizedScenarioId.match(/LS-\d+_(\d+)/);
  const scenarioClass = typeMatch ? typeMatch[1] : "UnknownType";

  const scenarioSnippet = `
:${sanitizedScenarioId} a :LossScenario ;
    :scenario-class "${scenarioClass}" ;
    :original-text "${scenarioText}" ;
    :has-control-action :${sanitizedActionId} ;
    :has-controlled-process :${sanitizedProcessId} ;
    :context "${context || ""}" ;
    :provided-status "${providedStatus || ""}" ;
    :feedback-status "${feedbackStatus || ""}" ;
    :has-feedback "${feedback || ""}" ;
    :process-reception-status "${processReceptionStatus || ""}" ;
    :process-execution-status "${processExecutionStatus || ""}" .
`;

  const controllerAssociationId = `${sanitizedScenarioId}--${sanitizedControllerId}-Participation`;
  const scenarioControllerAssocSnippet = `
:${controllerAssociationId} a :ScenarioControllerAssociation ;
    :belongs-to-scenario :${sanitizedScenarioId} ;
    :has-controller :${sanitizedControllerId} ;
    :provided-status "${providedStatus || ""}" ;
    :feedback-status "${feedbackStatus || ""}" .
`;

  const controlActionAssociationId = `${sanitizedScenarioId}--${sanitizedActionId}-Association`;
  const scenarioControlActionAssocSnippet = `
:${controlActionAssociationId} a :ScenarioControlActionAssociation ;
    :belongs-to-scenario :${sanitizedScenarioId} ;
    :has-control-action :${sanitizedActionId} .
`;

  const feedbackAssociationId = `${sanitizedScenarioId}--Feedback-Association`;
  const scenarioFeedbackAssocSnippet = (feedback && feedback.trim() !== "" && feedback.trim().toLowerCase() !== "n/a") ? `
:${feedbackAssociationId} a :ScenarioFeedbackAssociation ;
    :belongs-to-scenario :${sanitizedScenarioId} ;
    :has-feedback :${sanitizedFeedbackId(feedback)} .
` : "";

  let controllerSnippet = "";
  if (!definedControllers.has(sanitizedControllerId)) {
    controllerSnippet = `
:${sanitizedControllerId} a :Controller ;
    rdfs:label "${controller}" .
`;
    definedControllers.add(sanitizedControllerId);
  }

  let controlActionSnippet = "";
  if (!definedControlActions.has(sanitizedActionId)) {
    controlActionSnippet = `
:${sanitizedActionId} a :ControlAction ;
    rdfs:label "${controlAction}" .
`;
    definedControlActions.add(sanitizedActionId);
  }

  let controlledProcessSnippet = "";
  if (!definedProcesses.has(sanitizedProcessId)) {
    controlledProcessSnippet = `
:${sanitizedProcessId} a :ControlledProcess ;
    rdfs:label "${controlledProcess}" .
`;
    definedProcesses.add(sanitizedProcessId);
  }

  return (
    scenarioSnippet +
    scenarioControllerAssocSnippet +
    scenarioControlActionAssocSnippet +
    scenarioFeedbackAssocSnippet +
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
  feedback,
  processReceptionStatus,
  processExecutionStatus
) {
  const sanitizedScenarioId = scenarioId.replace(/[^\w-]/g, "_");
  const sanitizedControllerId = controller.replace(/[^\w-]/g, "_");
  const sanitizedActionId = controlAction.replace(/[^\w-]/g, "_");
  const sanitizedProcessId = controlledProcess.replace(/[^\w-]/g, "_");
  const sanitizedFeedbackId = feedback?.replace(/[^\w-]/g, "_");

  const typeMatch = sanitizedScenarioId.match(/LS-\d+_(\d+)/);
  const scenarioClass = typeMatch ? typeMatch[1] : "UnknownType";

  const controllerAssociationId = `${sanitizedScenarioId}--${sanitizedControllerId}-association`;
  const processAssociationId = `${sanitizedScenarioId}--${sanitizedProcessId}-association`;

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
    stpa:context "${context || ""}" ;
    stpa:provided-status "${providedStatus || ""}" ;
    stpa:feedback-status "${feedbackStatus || ""}" ;
    stpa:has-feedback stpa:${sanitizedFeedbackId} ;
    stpa:process-reception-status "${processReceptionStatus || ""}" ;
    stpa:process-execution-status "${processExecutionStatus || ""}" .
`;

  const scenarioControllerAssocSnippet = `
stpa:${controllerAssociationId} a stpa:ScenarioControllerAssociation ;
    stpa:belongs-to-scenario stpa:${sanitizedScenarioId} ;
    stpa:has-controller stpa:${sanitizedControllerId} ;
    stpa:provided-status "${providedStatus || ""}" ;
    stpa:feedback-status "${feedbackStatus || ""}" .
`;

  // NEW: Association for control action.
  const controlActionAssociationId = `${sanitizedScenarioId}--${sanitizedActionId}-association`;
  const scenarioControlActionAssocSnippet = `
stpa:${controlActionAssociationId} a stpa:ScenarioControlActionAssociation ;
    stpa:belongs-to-scenario stpa:${sanitizedScenarioId} ;
    stpa:has-control-action stpa:${sanitizedActionId} .
`;

  // NEW: Association for feedback.
  const feedbackAssociationId = `${sanitizedScenarioId}--Feedback-association`;
  const scenarioFeedbackAssocSnippet = (feedback && feedback.trim() !== "" && feedback.trim().toLowerCase() !== "n/a") ? `
stpa:${feedbackAssociationId} a stpa:ScenarioFeedbackAssociation ;
    stpa:belongs-to-scenario stpa:${sanitizedScenarioId} ;
    stpa:has-feedback stpa:${sanitizedFeedbackId} .
` : "";

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
    scenarioControlActionAssocSnippet,
    scenarioFeedbackAssocSnippet,
    scenarioProcessAssocSnippet
  };
}
