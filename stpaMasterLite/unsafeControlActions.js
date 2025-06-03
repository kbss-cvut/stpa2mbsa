const UCA_SHEET_NAME = "3. Unsafe control actions";

const ACTION_COLUMN = 2;
const CONTROLLED_PROCESS_COLUMN = 3;
const NOT_PROVIDING_UCA_COLUMN = 4;
const PROVIDING_UCA_COLUMN = 5;
const TEMPORAL_UCA_COLUMN = 6;
const DURATION_UCA_COLUMN = 7;

const UCA_SHEET_HEADER_ROW_COUNT = 3;
const UCA_SHEET_SCS_COLUMN_COUNT = 3;

const SELECT_OPTION_HEIGHT = 17;
const SELECT_PADDING = 5;

function createUnsafeControlAction() {
  const cell = SpreadsheetApp.getActiveSheet().getCurrentCell();
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  if (
    cell == null ||
    SpreadsheetApp.getActiveSheet().getName() !== UCA_SHEET_NAME
  ) {
    SpreadsheetApp.getUi().alert(
      "Please first select the cell for which you want to define unsafe control action.",
    );
    SpreadsheetApp.getActive().setActiveSheet(ucaSheet);
    return;
  }
  const row = cell.getRowIndex();
  const column = cell.getColumn();
  const action = new String(ucaSheet.getRange(row, ACTION_COLUMN).getValue());
  if (
    column < NOT_PROVIDING_UCA_COLUMN ||
    column > DURATION_UCA_COLUMN ||
    action.trim() === ""
  ) {
    const lastRow = getLastActionRow();
    if (lastRow === UCA_SHEET_HEADER_ROW_COUNT) {
      SpreadsheetApp.getUi().alert(`There are no actions to work with!`);
      return;
    }
    SpreadsheetApp.getUi().alert(
      `Please select a cell within the D${UCA_SHEET_HEADER_ROW_COUNT + 1}:G${lastRow} range.`,
    );
    return;
  }
  const controller = getController(ucaSheet, row);

  const form = HtmlService.createTemplateFromFile("createUnsafeControlAction");
  form.references = extractSystemLevelHazards();
  form.referencesSelectHeight =
    form.references.length * SELECT_OPTION_HEIGHT + SELECT_PADDING;
  form.ucaTextStub = constructUnsafeControlActionDefinitionStub(
    controller,
    action,
    column,
  );
  form.row = row;
  form.column = column;
  form.existing = getExistingUnsafeControlActionsInCell(cell);
  const possibleNextCell = resolveNextCell(cell);
  form.canAddNext =
    new String(
      ucaSheet.getRange(possibleNextCell.row, ACTION_COLUMN).getValue(),
    ).trim().length > 0;
  SpreadsheetApp.getUi().showModalDialog(
    form
      .evaluate()
      .setWidth(550)
      .setHeight(
        300 + form.referencesSelectHeight + (form.existing.length > 0 ? 12 : 0),
      ),
    "New Unsafe Control Action",
  );
}

function getLastActionRow() {
  const actions = SpreadsheetApp.getActive()
    .getSheetByName(UCA_SHEET_NAME)
    .getRange(`B${UCA_SHEET_HEADER_ROW_COUNT + 1}:B`)
    .getValues();
  return actions.filter(String).length + UCA_SHEET_HEADER_ROW_COUNT;
}

/**
 * Resolve controller from the merged cells (iterates over cells upwards from the specified row until it finds a non-empty one)
 */
function getController(sheet, rowIndex) {
  const range = sheet.getRange(
    `A${UCA_SHEET_HEADER_ROW_COUNT + 1}:A${rowIndex}`,
  );
  for (let i = range.getNumRows(); i >= 0; i--) {
    if (range.getCell(i, 1).getValue() !== "") {
      return range.getCell(i, 1).getValue();
    }
  }
}

function constructUnsafeControlActionDefinitionStub(
  controller,
  action,
  ucaType,
) {
  switch (ucaType) {
    case NOT_PROVIDING_UCA_COLUMN:
      return `${controller} does not provide the ${action} action `;
    case PROVIDING_UCA_COLUMN:
      return `${controller} provides the ${action} action `;
    case TEMPORAL_UCA_COLUMN:
      return `${controller} provides the ${action} action too early/late/out of order `;
    case DURATION_UCA_COLUMN:
      return `${controller} stops providing/applies the ${action} action too soon/late/long `;
    default:
      return "";
  }
}

function getExistingUnsafeControlActionsInCell(cell) {
  const val = cell.getValue();
  if (isExistingUCAValueEmpty(val)) {
    return [];
  }
  const ucas = val.split("\n\n");
  return ucas.map((uca) => uca.substring(0, uca.indexOf(")") + 1));
}

function isExistingUCAValueEmpty(value) {
  return value.trim().length === 0 || value === "N/A";
}

function onCreateUnsafeControlActionSubmit(data) {
  console.log(JSON.stringify(data));
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  SpreadsheetApp.getActive().setActiveSheet(ucaSheet);
  const cell = SpreadsheetApp.getActiveSheet().getRange(
    Number(data.row),
    Number(data.column),
  );
  const existingValue = cell.getValue();
  const ucaId = `UCA-${resolveUnsafeControlActionIndex(existingValue, data.overwrite, data.overwriteType)}`;
  const uca = `(${ucaId})\n${data.ucaDefinition}\n[${data.references.join(", ")}]`;
  if (isExistingUCAValueEmpty(existingValue)) {
    cell.setValue(uca);
  } else {
    if (data.overwriteType === "one") {
      const ucas = existingValue.split("\n\n");
      const indexToOverwrite = ucas.findIndex((u) =>
        u.startsWith(data.overwrite),
      );
      ucas.splice(indexToOverwrite, 1, uca);
      cell.setValue(ucas.join("\n\n"));
    } else {
      cell.setValue(
        `${existingValue}${existingValue.length > 0 ? "\n\n" : ""}${uca}`,
      );
    }
  }
  cell.setHorizontalAlignment("left");
  cell.setWrap(true);
  generateControllerConstraint(
    data.ucaDefinition,
    ucaId,
    cell,
    data.overwriteType,
  );
  setUcaForLossScenarios({
    id: ucaId,
    definition: data.ucaDefinition,
    fullText: uca,
    type: cell.getColumn(),
  });
  selectNextCell(cell);
  if (data.addAnother) {
    createUnsafeControlAction();
  }
}

function resolveUnsafeControlActionIndex(
  currentCellValue,
  toOverwrite,
  overwriteType,
) {
  if (
    currentCellValue.length > 0 &&
    currentCellValue !== "N/A" &&
    overwriteType === "one"
  ) {
    const id = extractId(toOverwrite[0], "UCA");
    if (id) {
      return id.substring(id.indexOf("-") + 1);
    }
  }
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  const actions = ucaSheet
    .getRange(`B${UCA_SHEET_HEADER_ROW_COUNT + 1}:B`)
    .getValues();
  const lastRow = actions.filter(String).length + UCA_SHEET_HEADER_ROW_COUNT;
  const range = ucaSheet.getRange(
    `D${UCA_SHEET_HEADER_ROW_COUNT + 1}:G${lastRow}`,
  );
  const rowCount = range.getNumRows();
  const columnCount = range.getNumColumns();
  let maxId = 0;
  for (let x = 1; x <= columnCount; x++) {
    for (let y = 1; y <= rowCount; y++) {
      const value = range.getCell(y, x).getValue();
      if (value !== "N/A" && value !== "") {
        const matches = value.match(/\((UCA-\w+)\)/gm);
        for (let i = 0; i < matches.length; i++) {
          const m = Number(
            matches[i].substring(
              matches[i].indexOf("-") + 1,
              matches[i].length - 1,
            ),
          );
          if (m > maxId) {
            maxId = m;
          }
        }
      }
    }
  }
  return maxId + 1;
}

function debug() {
  const result = resolveUnsafeControlActionIndex("", "", "none");
  console.log(result);
}

function extractId(value, prefix) {
  const re = new RegExp(`\\((${prefix}-\\w+)\\)`);
  const matches = value.match(re);
  return matches != null && matches.length > 1 ? matches[1] : undefined;
}

function generateControllerConstraint(uca, ucaId, ucaCell, overwriteType) {
  const row = ucaCell.getRow();
  const ucaColumn = ucaCell.getColumn();
  let constraint;
  switch (ucaColumn) {
    case NOT_PROVIDING_UCA_COLUMN:
      constraint = uca.replace("does not provide", "must provide");
      break;
    case PROVIDING_UCA_COLUMN:
      constraint = uca.replace("provides", "must not provide");
      break;
    case TEMPORAL_UCA_COLUMN:
      constraint = uca.replace("provides", "must not provide");
      break;
    case DURATION_UCA_COLUMN:
      constraint = uca
        .replace("stops providing", "must not stop providing")
        .replace("applies", "must not apply");
      break;
    default:
      constraint = "";
      break;
  }
  const constraintId = "C-" + ucaId.substring(4);
  const targetCell = ucaCell.getSheet().getRange(row, ucaColumn + 4);
  if (overwriteType === "none") {
    const existingValue = targetCell.getValue();
    targetCell.setValue(
      `${existingValue}${existingValue.length > 0 ? "\n\n" : ""}(${constraintId})\n${constraint}\n[${ucaId}]`,
    );
  } else {
    targetCell.setValue(
      replaceControllerConstraint(
        constraintId,
        `(${constraintId})\n${constraint}\n[${ucaId}]`,
        targetCell,
      ),
    );
  }
  targetCell.setHorizontalAlignment("left");
  targetCell.setWrap(true);
  targetCell.setVerticalAlignment("middle");
}

function replaceControllerConstraint(constraintId, constraint, cell) {
  const constraints = cell.getValue().split("\n\n");
  const indexToOverwrite = constraints.findIndex((c) =>
    c.startsWith("(" + constraintId + ")"),
  );
  constraints.splice(indexToOverwrite, 1, constraint);
  return constraints.join("\n\n");
}

function getControlStructureInfo(ucaCell) {
  const row = ucaCell.getRow();
  const controlAction = ucaCell
    .getSheet()
    .getRange(row, ACTION_COLUMN)
    .getValue();
  let controllerRow = row;
  let controller;
  do {
    controller = ucaCell.getSheet().getRange(controllerRow, 1).getValue();
    controllerRow--;
  } while (controller === "");
  const controlledProcess = SpreadsheetApp.getActive()
    .getSheetByName(CS_SHEET_NAME)
    .getRange(row, 3)
    .getValue();
  return {
    controller,
    controlAction,
    controlledProcess,
  };
}

function selectNextCell(currentCell) {
  const nextCell = resolveNextCell(currentCell);
  currentCell
    .getSheet()
    .setCurrentCell(
      currentCell.getSheet().getRange(nextCell.row, nextCell.column),
    );
}

function resolveNextCell(currentCell) {
  let row = currentCell.getRow();
  let column = currentCell.getColumn();
  if (column >= DURATION_UCA_COLUMN) {
    row++;
  } else {
    column++;
  }
  return { row, column };
}

let allHazards = [];
let nonReferencedHazards = new Set();

function validateStepThree() {
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  // First row is empty
  const actions = ucaSheet
    .getRange(`B${UCA_SHEET_HEADER_ROW_COUNT + 1}:B`)
    .getValues();
  const lastRow = actions.filter(String).length + UCA_SHEET_HEADER_ROW_COUNT;
  const range = ucaSheet.getRange(
    `D${UCA_SHEET_HEADER_ROW_COUNT + 1}:G${lastRow}`,
  );
  const rowCount = range.getNumRows();
  const columnCount = range.getNumColumns();
  const validators = [
    createUnsafeControlActionIdentifierValidator(),
    createHazardReferenceExistenceValidator(),
    createHazardReferenceValidityValidator(),
  ];
  const violations = [];
  allHazards = extractSystemLevelHazardIds();
  nonReferencedHazards = new Set(allHazards);
  const ucaIds = new Set();
  for (let y = 1; y <= rowCount; y++) {
    for (let x = 1; x <= columnCount; x++) {
      const ucaStr = range.getCell(y, x).getValue();
      if (ucaStr !== "N/A") {
        const ucas = ucaStr.split("\n\n");
        ucas.forEach((uca) => {
          const ucaId = uca.substring(1, uca.indexOf(")"));
          ucaIds.add(ucaId);
          validators.forEach((v) =>
            v(uca, ucaId, violations, {
              row: y + UCA_SHEET_HEADER_ROW_COUNT,
              column: x + UCA_SHEET_SCS_COLUMN_COUNT,
            }),
          );
          validateConstraintExistsForUnsafeControlAction(
            ucaId,
            y + UCA_SHEET_HEADER_ROW_COUNT,
            violations,
            {
              column: x + UCA_SHEET_SCS_COLUMN_COUNT,
              row: y + UCA_SHEET_HEADER_ROW_COUNT,
            },
          );
        });
      }
    }
  }
  validateUcaExistsForEachConstraint(ucaIds, lastRow, violations);
  validateAllHazardsAreReferencedByUnsafeControlActions(violations);
  validateControlStructureMatches(lastRow, violations);
  SpreadsheetApp.getActive().setActiveSheet(ucaSheet);
  showValidationResults(violations, "three");
}

function restoreStepThreeCellsBackground() {
  restoreUnsafeControlActionsCellsBackground();
  restoreStepOneCellsBackground();
}

function restoreUnsafeControlActionsCellsBackground() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  sheet
    .getRange(`D${UCA_SHEET_HEADER_ROW_COUNT}:K${STEP_THREE_MAX_EXPECTED_ROWS}`)
    .setBackground(WHITE_BACKGROUND);
}

/**
 * Checks that UCA identifiers are unique
 */
function createUnsafeControlActionIdentifierValidator() {
  const ucaIds = new Set();
  return (uca, ucaId, violations, cell) => {
    if (ucaIds.has(ucaId)) {
      violations.push({
        description: `Unsafe control action identifier ${ucaId} occurs multiple times.`,
        row: cell.row,
        column: cell.column,
      });
    } else {
      ucaIds.add(ucaId);
    }
  };
}

const REFERENCE_MATCHER = /\[([\w\-\w+\.?\w*,?\s?]+)\]/;

/**
 * Checks that the UCA references some hazards.
 */
function createHazardReferenceExistenceValidator() {
  return (uca, ucaId, violations, cell) => {
    const hazardRefs = uca.match(REFERENCE_MATCHER);
    if (
      hazardRefs == null ||
      hazardRefs.length !== 2 ||
      hazardRefs[1].trim().length === 0
    ) {
      violations.push({
        description: `Unsafe control action ${ucaId} does not define any hazard references.`,
        row: cell.row,
        column: cell.column,
      });
    }
  };
}

/**
 * Checks that the UCA references existing hazards.
 */
function createHazardReferenceValidityValidator() {
  return (uca, ucaId, violations, cell) => {
    const hazardRefsStr = uca.match(REFERENCE_MATCHER);
    if (hazardRefsStr == null || hazardRefsStr.length !== 2) {
      return;
    }
    const hazardRefs = hazardRefsStr[1].split(",");
    hazardRefs.forEach((ref) => {
      const validated = ref.trim();
      if (allHazards.indexOf(validated) === -1) {
        violations.push({
          description: `Unsafe control action ${ucaId} references an unknown system-level hazard '${validated}'`,
          row: cell.row,
          column: cell.column,
        });
      } else {
        nonReferencedHazards.delete(validated);
        allHazards
          .filter((h) => h.startsWith(`${validated}.`))
          .forEach((h) => nonReferencedHazards.delete(h));
      }
    });
  };
}

/**
 * Checks that there is a constraint referencing the unsafe control action with the specified id.
 *
 * It is expected that the constraint is declared in the same row.
 */
function validateConstraintExistsForUnsafeControlAction(
  ucaId,
  rowNumber,
  violations,
  cell,
) {
  const constraints = SpreadsheetApp.getActive()
    .getSheetByName(UCA_SHEET_NAME)
    .getRange(`H${rowNumber}:Z${rowNumber}`)
    .getValues()[0];
  let found = false;
  for (let i = 0; i < constraints.length; i++) {
    const constraint = constraints[i];
    if (String(constraint)) {
      const refs = String(constraint).match(/\[([\w\-,\s]+)\]/g);
      if (refs !== null && refs.find((r) => r.indexOf(ucaId) !== -1)) {
        found = true;
        break;
      }
    }
  }
  if (!found) {
    violations.push({
      description: `Unsafe control action ${ucaId} is not referenced by any declared constraint.`,
      row: cell.row,
      column: cell.column,
    });
  }
}

function validateUcaExistsForEachConstraint(ucaIds, lastRow, violations) {
  const allConstraints = SpreadsheetApp.getActive()
    .getSheetByName(UCA_SHEET_NAME)
    .getRange(`H${UCA_SHEET_HEADER_ROW_COUNT + 1}:K${lastRow}`)
    .getValues();
  for (let i = 0; i < allConstraints.length; i++) {
    const row = allConstraints[i];
    for (let j = 0; j < row.length; j++) {
      const constraints = row[j].split("\n\n");
      constraints.forEach((c) => {
        const cId = c.trim().substring(1, c.indexOf(")"));
        const referencesStr = c.match(REFERENCE_MATCHER);
        if (referencesStr != null && referencesStr.length === 2) {
          const refs = referencesStr[1].split(",");
          refs.forEach((r) => {
            if (!ucaIds.has(r.trim())) {
              violations.push({
                description: `Constraint ${cId} references an unknown unsafe control action '${r.trim()}'`,
                row: i + UCA_SHEET_HEADER_ROW_COUNT + 1,
                column: j + DURATION_UCA_COLUMN + 1,
              });
            }
          });
        }
      });
    }
  }
}

function validateAllHazardsAreReferencedByUnsafeControlActions(violations) {
  if (nonReferencedHazards.size === 0) {
    return;
  }
  const hazards = Array.from(nonReferencedHazards);
  const hazardIds = extractSystemLevelHazardIds();
  hazards.sort();
  hazards.forEach((h) => {
    const row = hazardIds.indexOf(h) + PURPOSE_HEADER_ROW_COUNT + 1;
    violations.push({
      description: `System-level hazard ${h} is not referenced by any unsafe control action.`,
      sheet: STEP_ONE_SHEET_NAME,
      column: HAZARD_ID_COLUMN,
      row: row,
    });
  });
}

/**
 * Checks that control structure in sheet 2. Control structure and 3. Unsafe control actions matches.
 */
function validateControlStructureMatches(lastRowIndex, violations) {
  const csSheet = SpreadsheetApp.getActive().getSheetByName(CS_SHEET_NAME);
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  let rowIndex = UCA_SHEET_HEADER_ROW_COUNT + 1;
  while (rowIndex <= lastRowIndex) {
    const csValues = csSheet.getRange(rowIndex, 1, 1, 2).getValues()[0];
    const ucaValues = ucaSheet.getRange(rowIndex, 1, 1, 2).getValues()[0];
    if (!csValues.every((val, idx) => val === ucaValues[idx])) {
      violations.push({
        description: `Control structure in sheets '${CS_SHEET_NAME}' and '${UCA_SHEET_NAME}' does not match on row ${rowIndex}. This may break loss scenario generation.`,
      });
    }
    rowIndex++;
  }
}
