const LOSS_SCENARIOS_HEADER_ROWS = 3;
const LOSS_SCENARIOS_SHEET_NAME = "4. Loss scenarios";

const LOSS_SCENARIO_TYPE_ONE_COLUMN = 2;
const LOSS_SCENARIO_TYPE_TWO_COLUMN = 3;
const LOSS_SCENARIO_TYPE_THREE_COLUMN = 4;
const LOSS_SCENARIO_TYPE_FOUR_COLUMN = 5;


function setUcaForLossScenarios(uca) {
  const row = Number(uca.id.substring(uca.id.indexOf("-") + 1)) + LOSS_SCENARIOS_HEADER_ROWS;
  const lsSheet = SpreadsheetApp.getActive().getSheetByName(LOSS_SCENARIOS_SHEET_NAME);
  const ucaCell = lsSheet.getRange(row, 1);
  ucaCell.setValue(uca.fullText);
  ucaCell.setWrap(true);
  ucaCell.setVerticalAlignment("middle");
  ucaCell.setBackground(NON_EDITABLE_BACKGROUND);
}

function generateLossScenariosForUca() {
  const currentCell = SpreadsheetApp.getActive().getCurrentCell();
  const uca = currentCell.getValue();
  if (SpreadsheetApp.getActive().getActiveSheet().getName() !== LOSS_SCENARIOS_SHEET_NAME || currentCell.getColumn() !== 1 || uca.trim() === "") {
    SpreadsheetApp.getUi().alert("Select a non-empty unsafe control action cell in sheet " + LOSS_SCENARIOS_SHEET_NAME);
    return;
  }
  const id = extractId(uca, "UCA");
  if (!id) {
    return;
  }
  const ucaCells = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME).getRange(UCA_SHEET_HEADER_ROW_COUNT + 1, NOT_PROVIDING_UCA_COLUMN, getLastActionRow() - UCA_SHEET_HEADER_ROW_COUNT, DURATION_UCA_COLUMN + 1 - NOT_PROVIDING_UCA_COLUMN);
  for (let r = 1; r <= ucaCells.getNumRows(); r++) {
    for (let c = 1; c <= ucaCells.getNumColumns(); c++) {
      const ucaCell = ucaCells.getCell(r, c);
      const ucaCellValue = ucaCell.getValue();
      if (ucaCellValue.indexOf(`(${id})`) !== -1) {
        const definition = uca.substring(uca.indexOf(")") + 1, uca.indexOf("[")).trim();
        const csInfo = getControlStructureInfo(ucaCell);
        generateLossScenarios({
          id,
          definition,
          fullText: uca,
          type: ucaCell.getColumn()
        }, csInfo, currentCell.getRow());
        return;
      }
    }
  }
  SpreadsheetApp.getUi().alert("Select a non-empty unsafe control action cell in sheet " + LOSS_SCENARIOS_SHEET_NAME);
}

function generateAllLossScenarios() {
  const lsSheet = SpreadsheetApp.getActive().getSheetByName(LOSS_SCENARIOS_SHEET_NAME);
  const startRow = LOSS_SCENARIOS_HEADER_ROWS + 1;
  const lastRow = lsSheet.getLastRow();
  const ucaRange = lsSheet.getRange(startRow, 1, lastRow - LOSS_SCENARIOS_HEADER_ROWS, 1);
  const ucaValues = ucaRange.getValues();

  for (let i = 0; i < ucaValues.length; i++) {
    const uca = ucaValues[i][0];
    if (!uca || uca.trim() === "") continue; // Skip empty cells
    generateLossScenariosForRow(i + startRow, uca);
  }

  SpreadsheetApp.getUi().alert("Generated all loss scenarios!");
}

function generateLossScenariosForRow(row, uca) {
  const id = extractId(uca, "UCA");
  if (!id) return;

  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  const ucaCells = ucaSheet.getRange(
    UCA_SHEET_HEADER_ROW_COUNT + 1,
    NOT_PROVIDING_UCA_COLUMN,
    getLastActionRow() - UCA_SHEET_HEADER_ROW_COUNT,
    DURATION_UCA_COLUMN + 1 - NOT_PROVIDING_UCA_COLUMN
  );

  for (let r = 1; r <= ucaCells.getNumRows(); r++) {
    for (let c = 1; c <= ucaCells.getNumColumns(); c++) {
      const ucaCell = ucaCells.getCell(r, c);
      const ucaCellValue = ucaCell.getValue();
      if (ucaCellValue.indexOf(`(${id})`) !== -1) {
        const definition = uca.substring(uca.indexOf(")") + 1, uca.indexOf("[")).trim();
        const csInfo = getControlStructureInfo(ucaCell);
        generateLossScenarios({
          id,
          definition,
          fullText: uca,
          type: ucaCell.getColumn()
        }, csInfo, row);
        return;
      }
    }
  }
}


// uca: id, definition, type, fullText; csInfo: controller, controlAction, controlledProcess
function generateLossScenarios(uca, csInfo, row) {
  loadApiKey();

  switch (uca.type) {
    case NOT_PROVIDING_UCA_COLUMN:
      generateLossScenarioOfTypeOneForUcaTypeOne(uca, csInfo, row);
      generateLossScenarioOfTypeTwoForUcaTypeOne(uca, csInfo, row, false);
      generateLossScenarioOfTypeThreeForUcaTypeOne(uca, csInfo, row);
      generateLossScenarioOfTypeFourForUcaTypeOne(uca, csInfo, row);
      break;
    case PROVIDING_UCA_COLUMN:
      generateLossScenarioOfTypeOneForUcaTypeTwo(uca, csInfo, row);
      generateLossScenarioOfTypeTwoForUcaTypeOne(uca, csInfo, row, false); // Same as UCA type one
      generateLossScenarioOfTypeThreeForUcaTypeTwo(uca, csInfo, row);
      generateLossScenarioOfTypeFourForUcaTypeTwo(uca, csInfo, row);
      break;
    case TEMPORAL_UCA_COLUMN:
      generateLossScenarioOfTypeOneForUcaTypeThree(uca, csInfo, row);
      generateLossScenarioOfTypeTwoForUcaTypeThree(uca, csInfo, row);
      generateLossScenarioOfTypeThreeForUcaTypeThree(uca, csInfo, row);
      generateLossScenarioOfTypeFourForUcaTypeThree(uca, csInfo, row);
      break;
    case DURATION_UCA_COLUMN:
      generateLossScenarioOfTypeOneForUcaTypeFour(uca, csInfo, row);
      generateLossScenarioOfTypeTwoForUcaTypeOne(uca, csInfo, row, true); // Same as UCA type one
      generateLossScenarioOfTypeThreeForUcaTypeFour(uca, csInfo, row);
      generateLossScenarioOfTypeFourForUcaTypeFour(uca, csInfo, row);
      break;
    default:
      break;
  }
  return row;
}

// 1. Unsafe controller behavior
function generateLossScenarioOfTypeOneForUcaTypeOne(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} does not provide the ${csInfo.controlAction} action - ${csInfo.controller} received feedback (or other inputs) that indicated ${startWith("that", context.text)}`;
  }

  setLossScenarioMetaData(csInfo, context, row, 6, "notProvided", "accurate");

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

function retrieveScenarioForPattern(pattern, values) {
  return retrieveChatGptResponse(`Write a loss scenario using the following pattern (variables are prefixed with a $): ${pattern}. Use the following values for the variables in the pattern: ${Object.keys(values).map(k => "$" + k + "=" + values[k]).join(", ")}. Return only the text of the scenario, stick to the provided pattern as much as possible.`);
}

function generateLossScenarioOfTypeOneForUcaTypeTwo(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} provides the ${csInfo.controlAction} action - ${csInfo.controller} received feedback (or other inputs) that indicated ${context.text}`;
  }

  setLossScenarioMetaData(csInfo, context, row, 6, "provided", "accurate");

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

function generateLossScenarioOfTypeOneForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} provides the ${csInfo.controlAction} action ${context.measure} - ${csInfo.controller} received feedback (or other inputs) that indicated ${context.text} ${context.measureInverse}`;
  }

  // Set provided status based on the measure (e.g., "providedTooEarly" or "providedTooLate")
  const provStatus = "provided" + (context.measure ? context.measure.replace(/\s+/g, "") : "");
  setLossScenarioMetaData(csInfo, context, row, 6, provStatus, "accurate");

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

function generateLossScenarioOfTypeOneForUcaTypeFour(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} ${context.stops ? "stops" : "continues"} providing the ${csInfo.controlAction} action ${context.measure} - ${csInfo.controller} received feedback (or other inputs) that indicated ${context.text} on time`;
  }

  const provStatus = context.stops ? "notProvided" : "provided";
  setLossScenarioMetaData(csInfo, context, row, 6, provStatus, "accurate");

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

// 2. Unsafe feedback path
function generateLossScenarioOfTypeTwoForUcaTypeOne(uca, csInfo, row, inappropriateDuration) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `Feedback (or other inputs) received by ${csInfo.controller} does not adequately indicate ${startWith("that", context.text)}${inappropriateDuration ? " (inappropriate duration)" : ""} - it is true that ${context.text}`;
  }

  setLossScenarioMetaData(csInfo, context, row, 7, "provided", "inaccurate");

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_TWO_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_TWO_COLUMN
  }, row);
}

function generateLossScenarioOfTypeTwoForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `Feedback (or other inputs) received by ${csInfo.controller} does not indicate ${context.text} ${context.measureInverse} - it is true that ${context.text}`;
  }
  setLossScenarioMetaData(csInfo, context, row, 7, "provided", "inaccurate");

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_TWO_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_TWO_COLUMN
  }, row);
}

// 3. Unsafe control path
function generateLossScenarioOfTypeThreeForUcaTypeOne(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} does provide the ${csInfo.controlAction} action when ${context.text} - ${csInfo.controlAction} is not received by ${csInfo.controlledProcess}`;
  }

  const processReceptionStatus = "notReceived";
  const processExecutionStatus = "n/a"; // Not applicable for control-path issues
  setLossScenarioMetaData(csInfo, context, row, 8, "provided", "accurate", processReceptionStatus, processExecutionStatus);

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}

// Controller does not provide action, but the process receives it.
function generateLossScenarioOfTypeThreeForUcaTypeTwo(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} does not provide the ${csInfo.controlAction} action when ${context.text} - ${csInfo.controlledProcess} receives ${csInfo.controlAction} action when ${context.text}`;
  }

  const processReceptionStatus = "received";
  const processExecutionStatus = "n/a";
  setLossScenarioMetaData(csInfo, context, row, 8, "notProvided", "accurate", processReceptionStatus, processExecutionStatus);

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}

function generateLossScenarioOfTypeThreeForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} provides the ${csInfo.controlAction} action ${context.measureInverse} when ${context.text} - ${csInfo.controlAction} is received by ${csInfo.controlledProcess} ${context.measure}`;
  }

  const provStatus = "provided" + (context.measure ? context.measure.replace(/\s+/g, "") : "");
  const processReceptionStatus = "received";
  const processExecutionStatus = "inappropriateTiming";

  setLossScenarioMetaData(csInfo, context, row, 8, provStatus, "accurate", processReceptionStatus, processExecutionStatus);

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}


// Controller provides action with appropriate duration, but the process receives it with inappropriate duration.
function generateLossScenarioOfTypeThreeForUcaTypeFour(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `${csInfo.controller} provides the ${csInfo.controlAction} action ${context.measureInverse} when ${context.text} - ${csInfo.controlAction} is received by ${csInfo.controlledProcess} ${context.measure}`;
  }

  const processReceptionStatus = "received";
  const processExecutionStatus = "inappropriateDuration";
  const provStatus = "provided" + (context.measure ? context.measure.replace(/\s+/g, "") : "");
  setLossScenarioMetaData(csInfo, context, row, 8, provStatus, "accurate", processReceptionStatus, processExecutionStatus);

  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}


// Action is received but process does not respond adequately.
function generateLossScenarioOfTypeFourForUcaTypeOne(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `The ${csInfo.controlAction} action is received by ${csInfo.controlledProcess} when ${context.text} - ${csInfo.controlledProcess} does not respond adequately (by <...>)`;
  }

  // Process is received but execution is unsafe.
  const processReceptionStatus = "received";
  const processExecutionStatus = "notResponding";
  setLossScenarioMetaData(csInfo, context, row, 9, "provided", "accurate", processReceptionStatus, processExecutionStatus);
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_FOUR_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_FOUR_COLUMN
  }, row);
}

// Action is not received, but the process still responds.
function generateLossScenarioOfTypeFourForUcaTypeTwo(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (!scenario) {
    scenario = `The ${csInfo.controlAction} action is not received by ${csInfo.controlledProcess} when ${context.text} - ${csInfo.controlledProcess} responds (by <...>)`;
  }

  const processReceptionStatus = "notReceived";
  const processExecutionStatus = "inadequate";
  setLossScenarioMetaData(csInfo, context, row, 9, "notProvided", "accurate", processReceptionStatus, processExecutionStatus);
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_FOUR_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_FOUR_COLUMN
  }, row);
}

// Action is received but with timing issues, leading to inadequate response.
function generateLossScenarioOfTypeFourForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let scenario;
  if (isChatGptAvailable()) {
    scenario = retrieveScenarioForPattern(`$action is received by $controlledProcess ${context.measureInverse} when $context - $controlledProcess does not respond adequately $measure`, {
      controlledProcess: csInfo.controlledProcess,
      action: csInfo.controlAction,
      context: context.text,
      measure: context.measure
    });
  }
  if (!scenario) {
    scenario = `The ${csInfo.controlAction} action is received by ${csInfo.controlledProcess} ${context.measureInverse} when ${context.text} - ${csInfo.controlledProcess} does not respond adequately (by <...>)${context.measure}`;
  }

  const processReceptionStatus = "received";
  const processExecutionStatus = "inadequate";
  setLossScenarioMetaData(csInfo, context, row, 9, "provided", "inaccurate", processReceptionStatus, processExecutionStatus);
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_FOUR_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_FOUR_COLUMN
  }, row);
}

// Action is received with appropriate duration, but process response is inadequate.
function generateLossScenarioOfTypeFourForUcaTypeFour(uca, csInfo, row) {
  let scenario;
  if (!scenario) {
    scenario = `The ${csInfo.controlAction} action is received by ${csInfo.controlledProcess} with appropriate duration - ${csInfo.controlledProcess} does not respond adequately (by <...>)(inappropriate duration)`;
  }

  const processReceptionStatus = "received";
  const processExecutionStatus = "inadequate";
  setLossScenarioMetaData(csInfo, null, row, 9, "provided", "inaccurate", processReceptionStatus, processExecutionStatus);
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_FOUR_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_FOUR_COLUMN
  }, row);
}

function extractContextFromUnsafeControlAction(uca, ucaType, controller, controlAction) {
  let context;
  switch (ucaType) {
    case NOT_PROVIDING_UCA_COLUMN:
      context = { text: uca.substring(`${controller} does not provide the ${controlAction} action`.length).trim() };
      break;
    case PROVIDING_UCA_COLUMN:
      context = { text: uca.substring(`${controller} provides the ${controlAction} action`.length).trim() };
      break;
    case TEMPORAL_UCA_COLUMN:
      context = extractContextFromTemporalUnsafeControlAction(uca, controller, controlAction);
      break;
    case DURATION_UCA_COLUMN:
      context = extractContextFromDurationUnsafeControlAction(uca, controller, controlAction);
      break;
    default:
      context = { text: "..." };
  }
  context.text = removeContextConjunction(context.text);
  if (context.text.endsWith(".")) {
    context.text = context.text.substring(0, context.text.length - 1);
  }
  return context;
}

function removeContextConjunction(context) {
  if (context.startsWith("when") || context.startsWith("that")) {
    context = context.substring(4);
  }
  if (context.startsWith("while")) {
    context = context.substring(5);
  }
  return context.trim();
}

function startWith(start, context) {
  if (context.startsWith(start)) {
    return context;
  }
  return `${start} ${context}`;
}

function extractContextFromTemporalUnsafeControlAction(uca, controller, controlAction) {
  // Pattern: `${controller} provides the ${controlAction} action too early/late/out of order `
  if (uca.indexOf(`${controller} provides the ${controlAction} action too early/late/out of order`) !== -1) {
    return {
      text: uca.substring(`${controller} provides the ${controlAction} action too early/late/out of order`.length).trim(),
      measure: "too early/late/out of order",
      measureInverse: "on time/in order"
    };
  } else if (uca.indexOf(`${controller} provides the ${controlAction} action too early`) !== -1) {
    return {
      text: uca.substring(`${controller} provides the ${controlAction} action too early`.length).trim(),
      measure: "too early",
      measureInverse: "on time"
    };
  } else if (uca.indexOf(`${controller} provides the ${controlAction} action too late`) !== -1) {
    return {
      text: uca.substring(`${controller} provides the ${controlAction} action too late`.length).trim(),
      measure: "too late",
      measureInverse: "on time"
    };
  } else if (uca.indexOf(`${controller} provides the ${controlAction} action out of order`) !== -1) {
    return {
      text: uca.substring(`${controller} provides the ${controlAction} action out of order`.length).trim(),
      measure: "out of order",
      measureInverse: "in order"
    };
  } else {
    return { text: "..." };
  }
}

function extractContextFromDurationUnsafeControlAction(uca, controller, controlAction) {
  // Pattern: `${controller} stops providing/applies the ${controlAction} action too soon/late/long`
  const actions = ["stops providing", "applies"];
  const measures = ["too soon", "too late", "too long", "too soon/late/long"];
  for (a of actions) {
    for (m of measures) {
      const pattern = `${controller} ${a} the ${controlAction} action ${m}`;
      if (uca.indexOf(pattern) !== -1) {
        return { text: uca.substring(pattern.length).trim(), measure: m, stops: a === "stops providing" };
      }
    }
  }
  return { text: "..." };
}

function generateLossScenarioId(uca, type) {
  const ucaNo = uca.id.substring(uca.id.indexOf("-") + 1);
  return `LS-${ucaNo}.${type - 1}`;
}

function setLossScenarioMetaData(csInfo, context, row, column, providedStatus, feedbackStatus, processReceptionStatus, processExecutionStatus) {
  const metadataObj = {
    controller: csInfo.controller,
    controlAction: csInfo.controlAction,
    controlledProcess: csInfo.controlledProcess,
    context: context?.text,
    providedStatus: providedStatus || "unknown",
    feedbackStatus: feedbackStatus || "unknown",
    processReceptionStatus: processReceptionStatus || "",
    processExecutionStatus: processExecutionStatus || ""
  };
  const metadataJson = JSON.stringify(metadataObj);
  const lsSheet = SpreadsheetApp.getActive().getSheetByName(LOSS_SCENARIOS_SHEET_NAME);
  const metadataCell = lsSheet.getRange(row, column);
  metadataCell.setValue(metadataJson);
  metadataCell.setWrap(true);
  metadataCell.setVerticalAlignment("middle");
}


function setLossScenario(scenario, row) {
  const lsSheet = SpreadsheetApp.getActive().getSheetByName(LOSS_SCENARIOS_SHEET_NAME);
  const lsCell = lsSheet.getRange(row, scenario.type);
  lsCell.setValue(scenario.scenario);
  lsCell.setWrap(true);
  lsCell.setVerticalAlignment("middle");
}

function getLossScenarios() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(LOSS_SCENARIOS_SHEET_NAME);
  const ucas = sheet.getRange(`A${LOSS_SCENARIOS_HEADER_ROWS + 1}:A`).getValues();
  const lastRow = ucas.filter(String).length + UCA_SHEET_HEADER_ROW_COUNT;
  const range = sheet.getRange(LOSS_SCENARIOS_HEADER_ROWS + 1, LOSS_SCENARIO_TYPE_ONE_COLUMN, lastRow, 4);
  const lossScenarios = range.getValues().flatMap(row => row.filter(cell => cell.length > 0));
  const scenarioMap = {};
  lossScenarios.forEach(ls => {
    const idMatch = ls.match(/\((LS-\w+\.\w+)\)/);
    if (idMatch === null || idMatch.length !== 2) {
      return;
    }
    const id = idMatch[1];
    scenarioMap[id] = ls;
  });
  return scenarioMap;
}

function getAllMetadata() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(LOSS_SCENARIOS_SHEET_NAME);
  const ucas = sheet.getRange(`A${LOSS_SCENARIOS_HEADER_ROWS + 1}:A`).getValues();
  const nonEmptyRows = ucas.filter(rowValue => rowValue[0]).length;
  const lastRow = (UCA_SHEET_HEADER_ROW_COUNT || 0) + nonEmptyRows;
  const metadataMap = {};

  for (let row = LOSS_SCENARIOS_HEADER_ROWS + 1; row <= lastRow; row++) {
    for (let scenarioCol = 2; scenarioCol <= 5; scenarioCol++) {
      const scenarioText = sheet.getRange(row, scenarioCol).getValue();
      if (!scenarioText || typeof scenarioText !== "string" || scenarioText.trim() === "") {
        continue;
      }
      const idMatch = scenarioText.match(/\((LS-[\w.-]+)\)/);
      if (!idMatch) {
        continue;
      }
      const scenarioId = idMatch[1];
      const metadataCol = scenarioCol + 4;
      const metadataJson = sheet.getRange(row, metadataCol).getValue();
      if (!metadataJson) {
        continue;
      }

      let metadataObj;
      try {
        metadataObj = JSON.parse(metadataJson);
      } catch (e) {
        continue;
      }
      metadataMap[scenarioId] = {
        scenarioText: scenarioText,
        controller: metadataObj.controller,
        controlAction: metadataObj.controlAction,
        controlledProcess: metadataObj.controlledProcess,
        context: metadataObj.context,
        providedStatus: metadataObj.providedStatus || "unknown",
        feedbackStatus: metadataObj.feedbackStatus || "unknown",
        processReceptionStatus: metadataObj.processReceptionStatus || "",
        processExecutionStatus: metadataObj.processExecutionStatus || ""
      };
    }
  }
  return metadataMap;
}