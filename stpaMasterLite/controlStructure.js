const CS_SHEET_NAME = "2. Control structure";
const NON_EDITABLE_BACKGROUND = "#efefef";

function showImportControlStructureDialog() {
  const ui = SpreadsheetApp.getUi();
  const fileUrl = ui.prompt("Enter the URL of a .graphml or .drawio file stored on your Google Drive.", ui.ButtonSet.OK_CANCEL);
  if (fileUrl.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  importControlStructure(fileUrl.getResponseText());
}

// Sample GraphML file: https://drive.google.com/file/d/1mPA8i7pK6bakxcSe_8bsKI4C4JIL36P0/view?usp=drive_link
// Sample Draw.io file: https://drive.google.com/file/d/1Or_xojee2DwRv2AeFLr82-UsLK7tH7RJ/view?usp=drive_link
// Another sample drawio file: https://drive.google.com/file/d/1BwLBMpxg01b3pcNMXD8Yn9M1rN0RsyK3/view?usp=sharing

function importControlStructure(fileUrl) {
  const file = DriveApp.getFileById(fileUrl.match(/[-\w]{25,}/));
  const content = file.getBlob().getDataAsString();
  const document = XmlService.parse(content);
  let controlStructure;
  if (document.getRootElement().getName() === "graphml") {
    controlStructure = resolveControlStructureFromGraphML(document);
  } else {
    controlStructure = resolveControlStructureFromDrawio(document);
  }
  generateControlStructureCells(controlStructure);
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  SpreadsheetApp.getActive().setActiveSheet(ucaSheet);
}

function resolveControlStructureFromGraphML(document) {
  const rootNode = document.getRootElement();
  const ns = XmlService.getNamespace("http://graphml.graphdrawing.org/xmlns");
  const graphNode = rootNode.getChild("graph", ns);
  const nodes = new Map();
  const edges = new Map();
  graphNode.getChildren().forEach(elem => {
    const name = elem.getName();
      if (name === "node") {
        const node = readGraphMLNode(elem);
        if (node) {
          nodes.set(node.id, node);
        }
      } else if (name === "edge") {
        const edge = readGraphMLEdge(elem);
        if (edge) {
          edges.set(edge.id, edge);
        }
      }
  });
  // Control structure: controller -> [{controlAction, controlledProcess}]
  return buildControlStructureFromEdgesAndNodes(edges, nodes);
}

function buildControlStructureFromEdgesAndNodes(edges, nodes) {
  const controlStructure = {};

  edges.forEach(edge => {
    // Grab the two nodes involved
    const sourceNode = nodes.get(edge.source);
    const targetNode = nodes.get(edge.target);
    if (!sourceNode || !targetNode) return;

    let controller, controlledProcess;

    if (edge.type === "ControlAction") {
      // Control action: arrow from controller -> controlled process
      controller = sourceNode;
      controlledProcess = targetNode;
    } else if (edge.type === "Feedback") {
      // Feedback: arrow from controlled process -> controller
      // so invert source/target
      controller = targetNode;
      controlledProcess = sourceNode;
    }

    // Create an entry in the controlStructure
    if (!controlStructure[controller.label]) {
      controlStructure[controller.label] = [];
    }

    controlStructure[controller.label].push({
      type: edge.type,
      label: edge.label,
      controlledProcess: controlledProcess.label
    });
  });

  return controlStructure;
}


const GRAPHML_NAMESPACE = XmlService.getNamespace("y", "http://www.yworks.com/xml/graphml");

function readGraphMLNode(nodeElem) {
  const id = nodeElem.getAttribute("id").getValue();
  const shapeNodeElem = nodeElem.getChildren().filter(child => child.getChildren().length > 0).map(child => child.getChild("ShapeNode", GRAPHML_NAMESPACE));
  if (shapeNodeElem.length !== 1) {
    return undefined;
  }
  const shapeElem = shapeNodeElem[0].getChild("Shape", GRAPHML_NAMESPACE);
  if (shapeElem == null || shapeElem.getAttribute("type").getValue() !== "rectangle") {
    return undefined;
  }
  const label = shapeNodeElem[0].getChildren("NodeLabel", GRAPHML_NAMESPACE).map(child => child.getText()).filter(t => t.trim().length > 0).join(" ").replace("\n", " ");
  return {id, label};
}

function readGraphMLEdge(edgeElem) {
  const id = edgeElem.getAttribute("id").getValue();
  const source = edgeElem.getAttribute("source").getValue();
  const target = edgeElem.getAttribute("target").getValue();
  if (source === target) {
    return undefined;
  }
  const edge = edgeElem.getChildren().filter(child => child.getChildren().length > 0).map(child => child.getChildren()[0])[0];
  const edgeType = edge.getChild("LineStyle", GRAPHML_NAMESPACE).getAttribute("type").getValue();
  if (edgeType !== "line" && edgeType !== "dashed") {
    return undefined;
  }
  const label = edge.getChild("EdgeLabel", GRAPHML_NAMESPACE).getText();
  return {
    id, source, target, type: edgeType === "line" ? "ControlAction" : "Feedback", label
  };
}

function resolveControlStructureFromDrawio(document) {
  const root = document.getRootElement();
  const cells = root.getChild('diagram').getChild('mxGraphModel').getChild('root').getChildren('mxCell');
  const nodes = resolveDrawioNodes(cells);
  const edges = resolveDrawioEdges(cells, nodes);
  return buildControlStructureFromEdgesAndNodes(edges, nodes);
}

function resolveDrawioNodes(cells) {
  const nodes = new Map();
  cells.filter(cell => {
    const geometry = cell.getChild("mxGeometry");
    return geometry !== null && geometry.getAttribute("x") !== null && geometry.getAttribute("width") !== null && geometry.getAttribute("relative") === null;
  }).forEach(cell => {
    const node = {
      id: cell.getAttribute("id").getValue(),
      label: parseLabelIfNecessary(cell.getAttribute("value").getValue()),
    };
    const geometry = cell.getChild("mxGeometry");
    node.x = Number(geometry.getAttribute("x").getValue());
    node.y = geometry.getAttribute("y") ? Number(geometry.getAttribute("y").getValue()) : 0;
    node.height = Number(geometry.getAttribute("height").getValue());
    node.width = Number(geometry.getAttribute("width").getValue());
    nodes.set(node.id, node);
  });
  return nodes;
}

function parseLabelIfNecessary(value) {
  const labelDoc = Cheerio.load(`<div>${value}</div>`);
  const label = labelDoc.text();
  return label.replace("&nbsp;", " ").replace("\n", " ").trim();
}

function resolveDrawioEdges(cells, nodes) {
  const edges = new Map();
  cells.filter(cell => isDrawioEdgeOrEdgeLabel(cell))
  .forEach(cell => {
    const id = cell.getAttribute("id").getValue();
    let edge;
    if (cell.getAttribute("style").getValue().indexOf("edgeLabel;") !== -1) {
      const edgeId = cell.getAttribute("parent").getValue();
      if (!edges.has(edgeId)) {
        return;
      }
      edge = edges.get(edgeId);
      edge.label = parseLabelIfNecessary(cell.getAttribute("value").getValue());
    } else {
      const edge = {id};
      edge.type = cell.getAttribute("style").getValue().indexOf("dashed=1;") !== -1 ? "Feedback" : "ControlAction";
      if (cell.getAttribute("value") !== null) {
        edge.label = cell.getAttribute("value").getValue();
      }
      if (cell.getAttribute("source") !== null) {
        edge.source = nodes.get(cell.getAttribute("source").getValue()).id;
      }
      if (cell.getAttribute("target") !== null) {
        edge.target = nodes.get(cell.getAttribute("target").getValue()).id;
      }
      const geometry = cell.getChild("mxGeometry");
      const points = getDrawioEdgePoints(geometry);
      points.forEach(p => {
        const x = Number(p.getAttribute("x").getValue());
        const y = Number(p.getAttribute("y").getValue());
        const matchingNode = Array.from(nodes.values()).find(n => x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + n.height);
        if (!matchingNode) {
          return;
        }
        if (p.getAttribute("as") === null) {
          return;
        }
        if (p.getAttribute("as").getValue() === "sourcePoint") {
          edge.source = matchingNode.id;
        } else {
          edge.target = matchingNode.id;
        }
      });
      if (edge.source && edge.target) {
        edges.set(id, edge);
      }
    }
  });
  return edges;
}

function isDrawioEdgeOrEdgeLabel(cell) {
  return cell.getAttribute("edge") !== null && cell.getAttribute("edge").getValue() === "1" || cell.getAttribute("style") !== null && cell.getAttribute("style").getValue().indexOf("edgeLabel;") !== -1;
}

function getDrawioEdgePoints(geometry) {
  const mxPoints = geometry.getChildren("mxPoint") || [];
  const directChildren = mxPoints.filter(p => p.getAttribute("as") !== null && (p.getAttribute("as").getValue() === "sourcePoint" || p.getAttribute("as").getValue() === "targetPoint"));
  if (directChildren.length > 0) {
    return directChildren;
  } else if (geometry.getChild("Array") != null && geometry.getChild("Array").getAttribute("as") !== null && geometry.getChild("Array").getAttribute("as").getValue() === "points") {
    return geometry.getChild("Array").getChildren("mxPoint").filter(p => p.getAttribute("as") !== null);
  }
  return [];
}

/**
 * Writes control actions (and now feedback) into two sheets:
 *  - Sheet 3 ("Unsafe control actions"): For control actions only
 *  - Sheet 2 ("Control structure"): For both control actions and feedback
 */
function generateControlStructureCells(controlStructure) {
  // Adjust these names if yours differ
  const UCA_SHEET_NAME = "3. Unsafe control actions";
  const CS_SHEET_NAME  = "2. Control structure";
  const NON_EDITABLE_BACKGROUND = "#efefef";

  // Grab both sheets
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  const csSheet  = SpreadsheetApp.getActive().getSheetByName(CS_SHEET_NAME);

  // Start writing at row 4 (as you indicated)
  let lastRow = 4;

  // Sort controllers alphabetically to get consistent ordering
  Object.keys(controlStructure).sort().forEach(controller => {
    // Write the controller name in column A on both sheets
    ucaSheet.getRange(lastRow, 1)
      .setValue(controller)
      .setBackground(NON_EDITABLE_BACKGROUND);

    csSheet.getRange(lastRow, 1)
      .setValue(controller)
      .setBackground(NON_EDITABLE_BACKGROUND);

    // Remember where this controller started so we can merge column A
    const controllerRow = lastRow;

    // Get all items (control actions and/or feedback)
    const items = controlStructure[controller];

    items.forEach(item => {
      if (item.type === "ControlAction") {
        // Possibly multiple lines in item.label
        const actions = item.label.split("\n");
        actions.forEach(actionText => {
          // --- Sheet 3 (UCA) ---
          ucaSheet.getRange(lastRow, 2) // Column B: Control Action
            .setValue(actionText)
            .setBackground(NON_EDITABLE_BACKGROUND);
          ucaSheet.getRange(lastRow, 3) // Column C: Controlled Process
            .setValue(item.controlledProcess)
            .setBackground(NON_EDITABLE_BACKGROUND);

          // If your original script filled columns D..G with "N/A" or something similar,
          // you can replicate that here, for example:
          // ucaSheet.getRange(lastRow, 4, 1, 4).setValue("N/A").setBackground(NON_EDITABLE_BACKGROUND);

          // --- Sheet 2 (CS) ---
          csSheet.getRange(lastRow, 2) // Column B: Control Action
            .setValue(actionText)
            .setBackground(NON_EDITABLE_BACKGROUND);
          csSheet.getRange(lastRow, 3) // Column C: Controlled Process
            .setValue(item.controlledProcess)
            .setBackground(NON_EDITABLE_BACKGROUND);

          // Move to the next row
          lastRow++;
        });
      }
      else if (item.type === "Feedback") {
        // Feedback lines can also have multiple lines
        const feedbackLines = item.label.split("\n");
        feedbackLines.forEach(fb => {
          // We only write feedback to the CS sheet
          csSheet.getRange(lastRow, 3) // Column C: Controlled Process
            .setValue(item.controlledProcess)
            .setBackground(NON_EDITABLE_BACKGROUND);
          csSheet.getRange(lastRow, 4) // Column D: Feedback
            .setValue(fb)
            .setBackground(NON_EDITABLE_BACKGROUND);

          // In the UCA sheet, we do NOT write anything for feedback,
          // so row "lastRow" will remain blank there.

          lastRow++;
        });
      }
    });

    // After processing all items for this controller, merge column A from
    // the first row we used (controllerRow) up to the row before lastRow.
    // If only 1 row was used, skip merging to avoid errors.
    const rowCount = lastRow - controllerRow;
    if (rowCount > 1) {
      // Merge the controller cells in the UCA sheet
      ucaSheet.getRange(controllerRow, 1, rowCount, 1).mergeVertically();
      // Merge the controller cells in the CS sheet
      csSheet.getRange(controllerRow, 1, rowCount, 1).mergeVertically();
    }
  });
}


