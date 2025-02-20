const PURPOSE_HEADER_ROW_COUNT = 2;
const STEP_ONE_SHEET_NAME = "1. Define analysis purpose";
const LOSS_ID_COLUMN = 1;
const LOSS_COLUMN = 2;
const HAZARD_ID_COLUMN = 4;
const HAZARD_COLUMN = 5;
const HAZARD_LOSS_REFS_COLUMN = 6;
const CONSTRAINT_ID_COLUMN = 8;
const CONSTRAINT_COLUMN = 9;
const CONSTRAINT_HAZARD_REFS_COLUMN = 10;


function addLoss() {
   console.log("IS THIS DEPLOYED?")
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  SpreadsheetApp.getActive().setActiveSheet(sheet);
  const form = HtmlService.createTemplateFromFile('createLoss');
  SpreadsheetApp.getUi().showModalDialog(form.evaluate().setWidth(520).setHeight(150), 'New Loss');
}

function onLossSubmit(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  const lastRow = sheet.getRange(`A${PURPOSE_HEADER_ROW_COUNT + 1}:A`).getValues().filter(String).length + PURPOSE_HEADER_ROW_COUNT;
  const nextRow = lastRow + 1;
  sheet.getRange(nextRow, 1).setValue("L-" + (nextRow - PURPOSE_HEADER_ROW_COUNT));
  sheet.getRange(nextRow, 2).setValue(data.description);
  if (data.addAnother) {
    addLoss();
  }
}

function addSystemLevelHazard() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  SpreadsheetApp.getActive().setActiveSheet(sheet);
  const lossIds = sheet.getRange(`A${PURPOSE_HEADER_ROW_COUNT + 1}:A`).getValues();
  const lastRow = lossIds.filter(String).length + PURPOSE_HEADER_ROW_COUNT;
  const range = sheet.getRange(PURPOSE_HEADER_ROW_COUNT + 1, LOSS_ID_COLUMN, lastRow, 2);
  const losses = range.getValues().filter(row => row[0] !== "").map(row => `${row[0]} ${row[1]}`);
  const form = HtmlService.createTemplateFromFile('createHazard');
  // console.log(form.getCode());
  form.losses = losses;
  form.itemType = "hazard";
  form.parents = extractSystemLevelHazards();
  SpreadsheetApp.getUi().showModalDialog(form.evaluate().setWidth(520).setHeight(300), 'New System-level Hazard');
}

function onSystemLevelHazardSubmit(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  const hazardIds = extractSystemLevelHazardIds();
  let targetRow;
  let hazardId;
  if (data.parent === "none" || data.parent === undefined) {
    targetRow = hazardIds.length + PURPOSE_HEADER_ROW_COUNT + 1;
    if (hazardIds.length === 0) {
      hazardId = "H-1";
    } else {
      const lastId = hazardIds[hazardIds.length - 1];
      const highestHazardNumber = Number(lastId.substring(2, lastId.indexOf(".") !== -1 ? lastId.indexOf(".") : lastId.length));
      hazardId = "H-" + (highestHazardNumber + 1);
    }
  } else {
    const parentId = data.parent;
    const parentAndSiblingIds = hazardIds.filter(h => h.startsWith(parentId));
    const closestSibling = parentAndSiblingIds[parentAndSiblingIds.length - 1];
    const targetIndex = hazardIds.findIndex(h => h === closestSibling);
    targetRow = targetIndex + PURPOSE_HEADER_ROW_COUNT + 2;
    shiftHazardRowsIfNecessary(sheet, hazardIds.length + PURPOSE_HEADER_ROW_COUNT + 1, targetRow);
    if (parentId === closestSibling) {
      hazardId = parentId + ".1";
    } else {
      const closestSiblingNumber = Number(closestSibling.substring(closestSibling.lastIndexOf(".") + 1, closestSibling.length));
      hazardId = parentId + "." + (closestSiblingNumber + 1);
    }
  }
  sheet.getRange(targetRow, HAZARD_ID_COLUMN).setValue(hazardId);
  sheet.getRange(targetRow, HAZARD_COLUMN).setValue(data.description);
  sheet.getRange(targetRow, HAZARD_LOSS_REFS_COLUMN).setValue(`[${data.losses.join(', ')}]`);
  if (data.addAnother) {
    addSystemLevelHazard();
  }
}

function shiftHazardRowsIfNecessary(sheet, lastRow, targetRow) {
  let row = lastRow;
  while (row >= targetRow) {
    sheet.getRange(row + 1, HAZARD_ID_COLUMN).setValue(sheet.getRange(row, HAZARD_ID_COLUMN).getValue());
    sheet.getRange(row + 1, HAZARD_COLUMN).setValue(sheet.getRange(row, HAZARD_COLUMN).getValue());
    sheet.getRange(row + 1, HAZARD_LOSS_REFS_COLUMN).setValue(sheet.getRange(row, HAZARD_LOSS_REFS_COLUMN).getValue());
    row--;
  }
}

function addSystemLevelConstraint() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  SpreadsheetApp.getActive().setActiveSheet(sheet);
  const form = HtmlService.createTemplateFromFile('createConstraint');
  form.hazards = extractSystemLevelHazards();
  form.itemType = "constraint";
  SpreadsheetApp.getUi().showModalDialog(form.evaluate().setWidth(520).setHeight(250), 'New System-level Constraint');
}

function extractSystemLevelHazards() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  const hazardIds = sheet.getRange(`D${PURPOSE_HEADER_ROW_COUNT + 1}:D`).getValues().filter(String);
  if (hazardIds.length === 0) {
    return [];
  }
  const lastRow = hazardIds.length + PURPOSE_HEADER_ROW_COUNT + 1;
  const range = sheet.getRange(PURPOSE_HEADER_ROW_COUNT + 1, HAZARD_ID_COLUMN, lastRow, 2);
  return range.getValues().filter(row => row[0] !== "").map(row => (`${row[0]} ${row[1]}`));
}

function extractSystemLevelHazardIds() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  const hazardIds = sheet.getRange(`D${PURPOSE_HEADER_ROW_COUNT + 1}:D`).getValues().filter(String);
  if (hazardIds.length === 0) {
    return [];
  }
  const lastRow = hazardIds.length +  PURPOSE_HEADER_ROW_COUNT + 1;
  const range = sheet.getRange(PURPOSE_HEADER_ROW_COUNT + 1, HAZARD_ID_COLUMN, lastRow, 2);
  return range.getValues().filter(row => row[0] !== "").map(row => row[0]);
}

function onSystemLevelConstraintSubmit(data) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  const constraintIds = sheet.getRange(`H${PURPOSE_HEADER_ROW_COUNT + 1}:H`).getValues().filter(String);
  const targetRow = constraintIds.length + PURPOSE_HEADER_ROW_COUNT + 1;
  sheet.getRange(targetRow, CONSTRAINT_ID_COLUMN).setValue("SC-" + (constraintIds.length + 1));
  sheet.getRange(targetRow, CONSTRAINT_COLUMN).setValue(data.description);
  sheet.getRange(targetRow, CONSTRAINT_HAZARD_REFS_COLUMN).setValue(`[${data.hazards.join(', ')}]`);
  if (data.addAnother) {
    addSystemLevelConstraint();
  }
}

function validateStepOne() {
  restoreStepOneCellsBackground();
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  const losses = sheet.getRange(`A${PURPOSE_HEADER_ROW_COUNT + 1}:A`).getValues().filter(String).map((row, i) => ({value: row[0], column: LOSS_ID_COLUMN, row: i + 1 + PURPOSE_HEADER_ROW_COUNT}));
  const hazards = sheet.getRange(`D${PURPOSE_HEADER_ROW_COUNT + 1}:D`).getValues().filter(String).map((row, i) => ({value: row[0], column: HAZARD_ID_COLUMN, row: i + 1 + PURPOSE_HEADER_ROW_COUNT}));
  const hazardLossRefs = sheet.getRange(`F${PURPOSE_HEADER_ROW_COUNT + 1}:F`).getValues().filter(String).map((row,i) => ({value: row[0], column: HAZARD_LOSS_REFS_COLUMN, row: i + 1 +  PURPOSE_HEADER_ROW_COUNT}));
  const constraints = sheet.getRange(`H${PURPOSE_HEADER_ROW_COUNT + 1}:H`).getValues().filter(String).map((row, i) => ({value: row[0], column: CONSTRAINT_ID_COLUMN, row: i + 1 + PURPOSE_HEADER_ROW_COUNT}));
  const constraintHazardRefs = sheet.getRange(`J${PURPOSE_HEADER_ROW_COUNT + 1}:J`).getValues().filter(String).map((row, i) => ({value: row[0], column: CONSTRAINT_HAZARD_REFS_COLUMN, row: i + 1 + PURPOSE_HEADER_ROW_COUNT}));
  
  // Ids must be unique
  let violations = validateIdUniqueness(losses, "Loss");
  violations = violations.concat(validateIdUniqueness(hazards, "System-level hazard"));
  violations = violations.concat(validateIdUniqueness(constraints, "System-level constraint"));
  // Every hazard must reference at least one loss, all loss references must exist
  // Every constraint must reference at least one hazard, all hazard references must exist
  violations = violations.concat(validateReferences(hazardLossRefs, losses, hazards, "System-level hazard", "Loss"));
  violations = violations.concat(validateReferences(constraintHazardRefs, hazards, constraints, "System-level constraint", "System-level hazard"));

  SpreadsheetApp.getActive().setActiveSheet(sheet);
  showValidationResults(violations, "one");
}

// Restores background that may have been modified by validation
function restoreStepOneCellsBackground() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
  sheet.getRange(`A${PURPOSE_HEADER_ROW_COUNT + 1}:A${STEP_ONE_MAX_EXPECTED_ROWS}`).setBackground(NON_EDITABLE_BACKGROUND);
  sheet.getRange(`D${PURPOSE_HEADER_ROW_COUNT + 1}:D${STEP_ONE_MAX_EXPECTED_ROWS}`).setBackground(NON_EDITABLE_BACKGROUND);
  sheet.getRange(`F${PURPOSE_HEADER_ROW_COUNT + 1}:F${STEP_ONE_MAX_EXPECTED_ROWS}`).setBackground(NON_EDITABLE_BACKGROUND);
  sheet.getRange(`H${PURPOSE_HEADER_ROW_COUNT + 1}:H${STEP_ONE_MAX_EXPECTED_ROWS}`).setBackground(NON_EDITABLE_BACKGROUND);
  sheet.getRange(`J${PURPOSE_HEADER_ROW_COUNT + 1}:J${STEP_ONE_MAX_EXPECTED_ROWS}`).setBackground(NON_EDITABLE_BACKGROUND);
}

function validateIdUniqueness(ids, itemType) {
  // All IDs must be unique
  const idsToCount = new Map();
  ids.forEach(id => {
    if (idsToCount.has(id.value)) {
      idsToCount.set(id.value, idsToCount.get(id.value) + 1);
    } else {
      idsToCount.set(id.value, 1);
    }
  });
  const result = [];
  idsToCount.forEach((v, k) => {
    if (v > 1) {
      result.push({
        description: `${itemType} ID ${k} occurs ${v} times in the list.`
      });
    }
  });
  return result;
}

function validateReferences(references, referencedItems, referencingItems, referencingType, referencedType) {
  // Every item must reference at least one referenced item
  // Every reference must point to an existing referenced item
  // Every referenced item must be referenced by at least one item
  const result = [];
  const nonReferencedIds = new Map();
  referencedItems.forEach(item => nonReferencedIds.set(item.value, item));
  references.forEach((ref, i) => {
    const individualRefs = ref.value.length > 2 ? ref.value.substring(1, ref.value.length - 1).split(",").map(s => s.trim()) : [];
    if (individualRefs.length === 0) {
      result.push({
        description: `${referencingType} ${referencingItems[i].value} is not linked to any ${referencedType}.`,
        column: ref.column,
        row: ref.row
      });
      return;
    }
    individualRefs.forEach(r => {
      if (referencedItems.findIndex(ri => ri.value === r) === -1) {
        result.push({
          description: `${referencingType} ${referencingItems[i].value} refers to an unknown ${referencedType} '${r}'.`,
          column: ref.column,
          row: ref.row
        });
      } else {
        nonReferencedIds.delete(r);
      }
    });
  });
  nonReferencedIds.forEach((v, k) => {
    result.push({
      description: `${referencedType} ${k} is not referenced by any ${referencingType}.`,
      column: v.column,
      row: v.row
    });
  });
  return result;
}

function showValidationResults(violations, step) {
  const sidebar = HtmlService.createTemplateFromFile('validationResults');
  let sheet;
  switch (step) {
    case "one":
      sheet = SpreadsheetApp.getActive().getSheetByName(STEP_ONE_SHEET_NAME);
      break;
    case "three":
      sheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
      break;
    case "slr":
      sheet = SpreadsheetApp.getActive().getSheetByName(SLR_SHEET_NAME);
      break;
    default:
      break;
  }
  const violationMessages = [];
  violations.forEach(v => {
    violationMessages.push(v.description);
    if (v.row) {
      if (v.sheet) {
        SpreadsheetApp.getActive().getSheetByName(v.sheet).getRange(v.row, v.column).setBackground("#e06666");
      } else {
        sheet.getRange(v.row, v.column).setBackground("#e06666");
      }
    }
  })
  sidebar.violations = violationMessages;
  sidebar.step = step;
  SpreadsheetApp.getUi().showSidebar(sidebar.evaluate().setTitle("Validation"));
}

function rerunValidation(step) {
  console.log("Rerun validation step " + step);
  switch(step) {
    case "one":
      validateStepOne();
      break;
    case "three":
      validateStepThree();
      break;
    case "slr":
      validateSystemLevelRequirements();
    default:
      break;
  }
}
