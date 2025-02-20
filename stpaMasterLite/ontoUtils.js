const ONTOLOGY_FILE_NAME = "loss_scenario.ttl"

function ensurePrefixes() {
  const file = getOrCreateTtlFile();
  let content = file.getBlob().getDataAsString();

  // Check if we have a prefix line
  if (!content.includes("@prefix")) {
    const prefixes = [
      "@prefix : <http://example.org/stpa#> .",
      "@prefix stpa: <http://example.org/stpa#> .",
      // add other prefixes as needed...
      ""
    ].join("\n");
    file.setContent(prefixes + "\n" + content);
  }
}

function getOrCreateTtlFile() {
  const files = DriveApp.getFilesByName(ONTOLOGY_FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }
  const newFile = DriveApp.createFile(ONTOLOGY_FILE_NAME, "");
  return newFile;
}

function appendToTtlFile(text) {
  const file = getOrCreateTtlFile();
  const oldContent = file.getBlob().getDataAsString();
  file.setContent(oldContent + "\n" + text);
}