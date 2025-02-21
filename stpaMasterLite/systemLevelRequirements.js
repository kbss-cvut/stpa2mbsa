const SLR_SHEET_NAME = "System-level Requirements";
const SLR_SHEET_HEADER_ROWS = 2;

function addSystemLevelRequirement() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SLR_SHEET_NAME);
  SpreadsheetApp.getActive().setActiveSheet(sheet);
  const form = HtmlService.createTemplateFromFile(
    "createSystemLevelRequirement",
  );
  const lossScenarios = getLossScenarios();
  form.lossScenarios = lossScenarios;
  form.lossScenariosHeight =
    Object.keys(lossScenarios).length * SELECT_OPTION_HEIGHT + SELECT_PADDING;
  form.existing = {
    references: [],
  };
  SpreadsheetApp.getUi().showModalDialog(
    form
      .evaluate()
      .setWidth(720)
      .setHeight(280 + form.lossScenariosHeight),
    "New System-level Requirement",
  );
}

function updateSystemLevelRequirement() {
  const range = SpreadsheetApp.getActiveRange();
  if (range == null || range.getSheet().getName() !== SLR_SHEET_NAME) {
    SpreadsheetApp.getUi().alert(
      "Select a requirement in the " + SLR_SHEET_NAME + " spreadsheet.",
    );
    return;
  }
  const row = range.getRow();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SLR_SHEET_NAME);
  const itemCount = sheet
    .getRange(`A${SLR_SHEET_HEADER_ROWS + 1}:A`)
    .getValues()
    .filter(String).length;
  if (row > itemCount + SLR_SHEET_HEADER_ROWS) {
    SpreadsheetApp.getUi().alert(
      "Select a requirement in the " + SLR_SHEET_NAME + " spreadsheet.",
    );
    return;
  }
  const form = HtmlService.createTemplateFromFile(
    "createSystemLevelRequirement",
  );
  const lossScenarios = getLossScenarios();
  form.lossScenarios = lossScenarios;
  form.lossScenariosHeight =
    Object.keys(lossScenarios).length * SELECT_OPTION_HEIGHT + SELECT_PADDING;
  form.existing = {
    isExisting: true,
    description: sheet.getRange(row, 2).getValue(),
    rationale: sheet.getRange(row, 4).getValue(),
    references: resolveExistingSystemLevelRequirementReferences(
      sheet.getRange(row, 3).getValue(),
    ),
    row,
  };
  SpreadsheetApp.getUi().showModalDialog(
    form
      .evaluate()
      .setWidth(720)
      .setHeight(280 + form.lossScenariosHeight),
    "Update System-level Requirement",
  );
}

function resolveExistingSystemLevelRequirementReferences(value) {
  if (value.length === 0) {
    return [];
  }
  const refs = value.substring(1, value.length - 1).split(",");
  return refs.map((r) => r.trim());
}

function onSystemLevelRequirementSubmit(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SLR_SHEET_NAME);
  const itemCount = sheet
    .getRange(`A${SLR_SHEET_HEADER_ROWS + 1}:A`)
    .getValues()
    .filter(String).length;
  let targetRow;
  if (data.existing) {
    targetRow = data.row;
  } else {
    targetRow = itemCount + SLR_SHEET_HEADER_ROWS + 1;
    const idCell = sheet.getRange(targetRow, 1);
    idCell.setValue(`SLR-${itemCount + 1}`);
    idCell.setVerticalAlignment("middle");
  }
  const slrCell = sheet.getRange(targetRow, 2);
  slrCell.setWrap(true);
  slrCell.setHorizontalAlignment("left");
  slrCell.setValue(data.description);
  slrCell.setVerticalAlignment("middle");
  const referenceCell = sheet.getRange(targetRow, 3);
  referenceCell.setWrap(true);
  referenceCell.setHorizontalAlignment("left");
  referenceCell.setValue(`[${data.scenarios.join(", ")}]`);
  referenceCell.setVerticalAlignment("middle");
  const rationaleCell = sheet.getRange(targetRow, 4);
  rationaleCell.setWrap(true);
  rationaleCell.setHorizontalAlignment("left");
  rationaleCell.setValue(data.rationale || "");
  rationaleCell.setVerticalAlignment("middle");
  if (data.addAnother) {
    addSystemLevelRequirement();
  }
}

function validateSystemLevelRequirements() {
  restoreSystemLevelRequirementsCellsBackground();
  const sheet = SpreadsheetApp.getActive().getSheetByName(SLR_SHEET_NAME);
  const lossScenarios = getLossScenarios();
  const scenarioReferences = sheet
    .getRange(`C${SLR_SHEET_HEADER_ROWS + 1}:C`)
    .getValues()
    .filter(String)
    .map((row) => row[0]);
  let violations = validateLossScenariosReferencedBySystemLevelRequirements(
    lossScenarios,
    scenarioReferences,
  );
  violations = violations.concat(
    validateSystemLevelRequirementsReferenceExistingScenarios(
      Object.keys(lossScenarios),
      scenarioReferences,
      sheet,
    ),
  );
  showValidationResults(violations, "slr");
}

function restoreSystemLevelRequirementsCellsBackground() {
  restoreUnsafeControlActionsCellsBackground();
  const slrSheet = SpreadsheetApp.getActive().getSheetByName(SLR_SHEET_NAME);
  slrSheet
    .getRange(`A${SLR_SHEET_HEADER_ROWS}:A${SLR_MAX_EXPECTED_ROWS}`)
    .setBackground(NON_EDITABLE_BACKGROUND);
  slrSheet
    .getRange(`C${SLR_SHEET_HEADER_ROWS}:C${SLR_MAX_EXPECTED_ROWS}`)
    .setBackground(NON_EDITABLE_BACKGROUND);
}

function validateLossScenariosReferencedBySystemLevelRequirements(
  lossScenarios,
  scenarioReferences,
) {
  const scenariosSheet = SpreadsheetApp.getActive().getSheetByName(
    LOSS_SCENARIOS_SHEET_NAME,
  );
  const ucas = scenariosSheet
    .getRange(`A${LOSS_SCENARIOS_HEADER_ROWS + 1}:A`)
    .getValues();
  const lastRow = ucas.filter(String).length + UCA_SHEET_HEADER_ROW_COUNT;
  const range = scenariosSheet.getRange(
    LOSS_SCENARIOS_HEADER_ROWS + 1,
    LOSS_SCENARIO_TYPE_ONE_COLUMN,
    lastRow,
    4,
  );
  return Object.keys(lossScenarios)
    .filter((id) => {
      return scenarioReferences.find((r) => r.indexOf(id) !== -1) === undefined;
    })
    .map((id) => {
      let row, column;
      for (let i = 1; i <= range.getNumRows(); i++) {
        for (let j = 1; j <= range.getNumColumns(); j++) {
          if (range.getCell(i, j).getValue().indexOf(id) !== -1) {
            row = i + LOSS_SCENARIOS_HEADER_ROWS;
            column = j + LOSS_SCENARIO_TYPE_ONE_COLUMN - 1;
            break;
          }
        }
        if (row) {
          break;
        }
      }
      return {
        description: `Loss scenario [${id}] is not referenced by any system-level requirement.`,
        row,
        column,
        sheet: LOSS_SCENARIOS_SHEET_NAME,
      };
    });
}

function validateSystemLevelRequirementsReferenceExistingScenarios(
  scenarioIds,
  scenarioReferences,
  sheet,
) {
  const violations = [];
  scenarioReferences.forEach((cell, index) => {
    const references = cell.substring(1, cell.length - 1).split(",");
    if (references.length === 1 && references[0].trim().length === 0) {
      violations.push({
        description: `System-level requirement ${sheet.getRange(index + SLR_SHEET_HEADER_ROWS + 1, 1).getValue()} does not reference any loss scenario.`,
        row: index + SLR_SHEET_HEADER_ROWS + 1,
        column: 3,
      });
      return;
    }
    references
      .filter((r) => scenarioIds.indexOf(r.trim()) === -1)
      .forEach((r) =>
        violations.push({
          description: `System-level requirement ${sheet.getRange(index + SLR_SHEET_HEADER_ROWS + 1, 1).getValue()} references an unknown loss scenario ${r}.`,
          row: index + SLR_SHEET_HEADER_ROWS + 1,
          column: 1,
        }),
      );
  });
  return violations;
}
