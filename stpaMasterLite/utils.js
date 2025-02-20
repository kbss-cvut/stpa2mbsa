const NON_EDITABLE_BACKGROUND = "#efefef";
const WHITE_BACKGROUND = "#ffffff";

const STEP_ONE_MAX_EXPECTED_ROWS = 50;
const STEP_THREE_MAX_EXPECTED_ROWS = 150;
const SLR_MAX_EXPECTED_ROWS = 100;

const JSON_FILE_NAME = "scenarios.json";

function ensurePrefixes() {
  const file = getOrCreateTtlFile();
  let content = file.getBlob().getDataAsString();

  if (!content.includes("@prefix")) {
    const prefixes = [
      "@prefix : <http://example.org/stpa#> .",
      "@prefix stpa: <http://example.org/stpa#> .",
      ""
    ].join("\n");
    file.setContent(prefixes + "\n" + content);
  }
}

function getOrCreateJsonFile() {
  const files = DriveApp.getFilesByName(JSON_FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }
  const newFile = DriveApp.createFile(JSON_FILE_NAME, "", "application/json");
  return newFile;
}
