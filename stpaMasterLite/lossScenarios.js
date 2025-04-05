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
          id, definition, fullText: uca, type: ucaCell.getColumn()
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
  const ucaCells = ucaSheet.getRange(UCA_SHEET_HEADER_ROW_COUNT + 1, NOT_PROVIDING_UCA_COLUMN, getLastActionRow() - UCA_SHEET_HEADER_ROW_COUNT, DURATION_UCA_COLUMN + 1 - NOT_PROVIDING_UCA_COLUMN);

  for (let r = 1; r <= ucaCells.getNumRows(); r++) {
    for (let c = 1; c <= ucaCells.getNumColumns(); c++) {
      const ucaCell = ucaCells.getCell(r, c);
      const ucaCellValue = ucaCell.getValue();
      if (ucaCellValue.indexOf(`(${id})`) !== -1) {
        const definition = uca.substring(uca.indexOf(")") + 1, uca.indexOf("[")).trim();
        const csInfo = getControlStructureInfo(ucaCell);
        generateLossScenarios({
          id, definition, fullText: uca, type: ucaCell.getColumn()
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
      generateLossScenarioOfTypeTwoForUcaTypeOne(uca, csInfo, row);
      generateLossScenarioOfTypeThreeForUcaTypeOne(uca, csInfo, row);
      generateLossScenarioOfTypeFourForUcaTypeOne(uca, csInfo, row);
      break;
    case PROVIDING_UCA_COLUMN:
      generateLossScenarioOfTypeOneForUcaTypeTwo(uca, csInfo, row);
      generateLossScenarioOfTypeTwoForUcaTypeTwo(uca, csInfo, row);
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
      generateLossScenarioOfTypeTwoForUcaTypeFour(uca, csInfo, row);
      generateLossScenarioOfTypeThreeForUcaTypeFour(uca, csInfo, row);
      generateLossScenarioOfTypeFourForUcaTypeFour(uca, csInfo, row);
      break;
    default:
      break;
  }
  return row;
}

// ----- Class 1: Unsafe Controller Behavior -----
// UCA Type One: Controller does NOT provide the control action.
function generateLossScenarioOfTypeOneForUcaTypeOne(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  const scenario = `${csInfo.controller} does not provide the ${csInfo.controlAction} action when ${context.text} - ${csInfo.controller} received feedback "${chosenFeedback}" that indicated ${context.text}`;
  setLossScenarioMetaData(csInfo, context, row, 6, "notProvided", "accurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

// UCA Type Two: Controller provides the control action.
function generateLossScenarioOfTypeOneForUcaTypeTwo(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  const scenario = `${csInfo.controller} provides the ${csInfo.controlAction} action when ${context.text} - ${csInfo.controller} received feedback "${chosenFeedback}" that indicated ${context.text}`;
  setLossScenarioMetaData(csInfo, context, row, 6, "provided", "accurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

// UCA Type Three (Temporal): Controller provides the control action too early or too late.
function generateLossScenarioOfTypeOneForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  let providedStatus = "provided";
  if (context.measure === "too early") {
    providedStatus = "providedTooEarly";
  } else if (context.measure === "too late") {
    providedStatus = "providedTooLate";
  }
  const scenario = `${csInfo.controller} provides the ${csInfo.controlAction} action ${context.measure} - ${csInfo.controller} received feedback "${chosenFeedback}" that indicated ${context.text} on time/in order`;
  setLossScenarioMetaData(csInfo, context, row, 6, providedStatus, "accurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

// UCA Type Four (Duration): Controller stops or continues providing the control action with a duration issue.
function generateLossScenarioOfTypeOneForUcaTypeFour(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  let actionPhrase = context.stops ? "stops providing" : "continues providing";
  const scenario = `${csInfo.controller} ${actionPhrase} the ${csInfo.controlAction} action ${context.measure} - ${csInfo.controller} received "${chosenFeedback}" that indicated ${context.text} on time`;
  let providedStatus = context.stops ? "notProvided" : "provided";
  setLossScenarioMetaData(csInfo, context, row, 6, providedStatus, "accurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_ONE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_ONE_COLUMN
  }, row);
}

// ----- Class 2: Unsafe Feedback Path -----
// UCA Type One: Feedback does not adequately indicate the context.
function generateLossScenarioOfTypeTwoForUcaTypeOne(uca, csInfo, row, inappropriateDuration) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  let durationNote = inappropriateDuration ? " (inappropriate duration)" : "";
  const scenario = `Feedback "${chosenFeedback}" received by ${csInfo.controller} does not adequately indicate ${context.text}${durationNote} - it is true that ${context.text}`;
  setLossScenarioMetaData(csInfo, context, row, 7, "n/a", "inaccurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_TWO_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_TWO_COLUMN
  }, row);
}

// UCA Type Two: Feedback is provided but incorrectly indicates the context.
function generateLossScenarioOfTypeTwoForUcaTypeTwo(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  const scenario = `Feedback "${chosenFeedback}" received by ${csInfo.controller} incorrectly indicates that ${context.text} - it is true that ${context.text}`;
  setLossScenarioMetaData(csInfo, context, row, 7, "n/a", "inaccurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_TWO_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_TWO_COLUMN
  }, row);
}

// UCA Type Three (Temporal): Feedback with a temporal issue.
function generateLossScenarioOfTypeTwoForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  const scenario = `Feedback "${chosenFeedback}" received by ${csInfo.controller} does not indicate ${context.text} ${context.measureInverse} - it is true that ${context.text}`;
  setLossScenarioMetaData(csInfo, context, row, 7, "n/a", "inaccurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_TWO_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_TWO_COLUMN
  }, row);
}

// UCA Type Four (Duration): Feedback is provided for an inappropriate duration.
function generateLossScenarioOfTypeTwoForUcaTypeFour(uca, csInfo, row) {
  const context = extractContextFromDurationUnsafeControlAction(uca.definition, csInfo.controller, csInfo.controlAction);
  const chosenFeedback = chooseFeedbackForLossScenario(csInfo);
  const scenario = `Feedback "${chosenFeedback}" received by ${csInfo.controller} indicates ${context.text} for an inappropriate duration, failing to accurately reflect the true state`;
  setLossScenarioMetaData(csInfo, context, row, 7, "n/a", "inaccurate", "n/a", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_TWO_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_TWO_COLUMN
  }, row);
}

// ----- Class 3: Unsafe Control Path -----
// UCA Type One: Controller provides the action, but the controlled process does not receive it.
function generateLossScenarioOfTypeThreeForUcaTypeOne(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const scenario = `${csInfo.controller} does provide the ${csInfo.controlAction} action when ${context.text} - ${csInfo.controlAction} is not received by ${csInfo.controlledProcess} when ${context.text}`;
  setLossScenarioMetaData(csInfo, context, row, 8, "provided", "accurate", "notReceived", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}

// UCA Type Two: Controller does not provide the action, but the controlled process receives it.
function generateLossScenarioOfTypeThreeForUcaTypeTwo(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const scenario = `${csInfo.controller} does not provide the ${csInfo.controlAction} action when ${context.text} - ${csInfo.controlledProcess} receives the ${csInfo.controlAction} action when ${context.text}`;
  setLossScenarioMetaData(csInfo, context, row, 8, "notProvided", "accurate", "received", "n/a");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}

// UCA Type Three (Temporal): Controller provides the action with a timing modifier and the process receives it with corresponding temporal deviation.
function generateLossScenarioOfTypeThreeForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let providedStatus = "provided";
  let processExecutionStatus = "executed";
  if (context.measure === "too early") {
    providedStatus = "providedTooEarly";
    processExecutionStatus = "executedTooEarly";
  } else if (context.measure === "too late") {
    providedStatus = "providedTooLate";
    processExecutionStatus = "executedTooLate";
  }
  const scenario = `${csInfo.controller} does not provide the ${csInfo.controlAction} action when ${context.text} - ${csInfo.controlAction} is received by ${csInfo.controlledProcess} ${context.measure}`;
  setLossScenarioMetaData(csInfo, context, row, 8, providedStatus, "accurate", "received", processExecutionStatus);
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}

// UCA Type Four (Duration): Controller provides the action for an appropriate duration, but the controlled process receives it with an inappropriate duration.
function generateLossScenarioOfTypeThreeForUcaTypeFour(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const scenario = `${csInfo.controller} provides the ${csInfo.controlAction} action with appropriate duration - ${csInfo.controlAction} is received by ${csInfo.controlledProcess} with inappropriate duration`;
  setLossScenarioMetaData(csInfo, context, row, 8, "provided", "accurate", "received", "inappropriateDuration");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_THREE_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_THREE_COLUMN
  }, row);
}

// ----- Class 4: Unsafe Controlled Process Behavior -----
// UCA Type One: Process receives the action but does not respond adequately.
function generateLossScenarioOfTypeFourForUcaTypeOne(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const scenario = `The ${csInfo.controlAction} action is received by ${csInfo.controlledProcess} when ${context.text} - ${csInfo.controlledProcess} does not respond adequately`;
  setLossScenarioMetaData(csInfo, context, row, 9, "provided", "accurate", "notReceived", "executed");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_FOUR_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_FOUR_COLUMN
  }, row);
}

// UCA Type Two: Controller does not provide the action, process does not receive it, yet process responds erroneously.
function generateLossScenarioOfTypeFourForUcaTypeTwo(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const scenario = `The ${csInfo.controlAction} action is not received by ${csInfo.controlledProcess} when ${context.text} - ${csInfo.controlledProcess} responds erroneously`;
  setLossScenarioMetaData(csInfo, context, row, 9, "notProvided", "accurate", "notReceived", "erroneousResponse");
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_FOUR_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_FOUR_COLUMN
  }, row);
}

// UCA Type Three (Temporal): Process does not receive the action but erroneously executes it with a timing deviation.
function generateLossScenarioOfTypeFourForUcaTypeThree(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  let processExecutionStatus = "executed";
  if (context.measure === "too early") {
    processExecutionStatus = "executedTooEarly";
  } else if (context.measure === "too late") {
    processExecutionStatus = "executedTooLate";
  }
  const scenario = `The ${csInfo.controlAction} action is not received by ${csInfo.controlledProcess} when ${context.text} - ${csInfo.controlledProcess} executes the action ${context.measure}`;
  setLossScenarioMetaData(csInfo, context, row, 9, "provided", "accurate", "notReceived", processExecutionStatus);
  setLossScenario({
    scenario: `(${generateLossScenarioId(uca, LOSS_SCENARIO_TYPE_FOUR_COLUMN)}) ${scenario}`,
    type: LOSS_SCENARIO_TYPE_FOUR_COLUMN
  }, row);
}

// UCA Type Four (Duration): Process does not receive the action and responds with an inappropriate duration.
function generateLossScenarioOfTypeFourForUcaTypeFour(uca, csInfo, row) {
  const context = extractContextFromUnsafeControlAction(uca.definition, uca.type, csInfo.controller, csInfo.controlAction);
  const scenario = `The ${csInfo.controlAction} action is not received by ${csInfo.controlledProcess} when ${context.text} - ${csInfo.controlledProcess} responds inadequately (inappropriate duration)`;
  setLossScenarioMetaData(csInfo, context, row, 9, "provided", "accurate", "notReceived", "inappropriateDuration");
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

/**
 * Looks in the "2. Control structure" sheet for any feedback edges
 * that go from `controlledProcess` to `controller`.
 * Returns an array of feedback labels (strings).
 */
function getFeedbackOptions(controller, controlledProcess) {
  const csSheet = SpreadsheetApp.getActive().getSheetByName("2. Control structure");
  const data = csSheet.getDataRange().getValues();
  const feedbacks = [];
  let lastControllerValue = "";

  for (let i = 1; i < data.length; i++) {
    let csController = data[i][0];
    if (!csController || csController.toString().trim() === "") {
      csController = lastControllerValue;
    } else {
      lastControllerValue = csController;
    }
    const csControlAction = data[i][1];
    const csControlledProcess = data[i][2];
    const csFeedback = data[i][3];

    if (
      csController === controller &&
      csControlledProcess === controlledProcess &&
      csFeedback && csFeedback.toString().trim() !== ""
    ) {
      feedbacks.push(csFeedback);
    }
  }

  return feedbacks;
}



function chooseFeedbackForLossScenario(csInfo) {
  const feedbackOptions = getFeedbackOptions(csInfo.controller, csInfo.controlledProcess);

  if (feedbackOptions.length === 0) {
    return "";
  }

  if (feedbackOptions.length === 1) {
    return feedbackOptions[0];
  }

  const ui = SpreadsheetApp.getUi();
  const feedbackListText = feedbackOptions
    .map((fb, index) => `${index + 1}. ${fb}`)
    .join("\n");

  const response = ui.prompt(
    "Select Feedback",
    `Multiple feedback signals are possible:\n${feedbackListText}\n\n` +
    "Enter the number of the desired feedback:",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return "";
  }

  const choice = parseInt(response.getResponseText(), 10);
  if (isNaN(choice) || choice < 1 || choice > feedbackOptions.length) {
    ui.alert("Invalid choice, no feedback selected.");
    return "";
  }

  return feedbackOptions[choice - 1];
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