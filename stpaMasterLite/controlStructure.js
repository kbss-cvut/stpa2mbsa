const CS_SHEET_NAME = "2. Control structure";

function showImportControlStructureDialog() {
  const ui = SpreadsheetApp.getUi();
  const fileUrl = ui.prompt(
    "Enter the URL of a .graphml or .drawio file stored on your Google Drive.",
    ui.ButtonSet.OK_CANCEL,
  );
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
  graphNode.getChildren().forEach((elem) => {
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
  edges.forEach((edge, id) => {
    if (edge.type === "ControlAction") {
      const controller = nodes.get(edge.source);
      const controlledProcess = nodes.get(edge.target);
      if (!controlStructure[controller.label]) {
        controlStructure[controller.label] = [];
      }
      controlStructure[controller.label].push({
        controlAction: edge.label,
        controlledProcess: controlledProcess.label,
      });
    }
  });
  return controlStructure;
}

const GRAPHML_NAMESPACE = XmlService.getNamespace(
  "y",
  "http://www.yworks.com/xml/graphml",
);

function readGraphMLNode(nodeElem) {
  const id = nodeElem.getAttribute("id").getValue();
  const shapeNodeElem = nodeElem
    .getChildren()
    .filter((child) => child.getChildren().length > 0)
    .map((child) => child.getChild("ShapeNode", GRAPHML_NAMESPACE));
  if (shapeNodeElem.length !== 1) {
    return undefined;
  }
  const shapeElem = shapeNodeElem[0].getChild("Shape", GRAPHML_NAMESPACE);
  if (
    shapeElem == null ||
    shapeElem.getAttribute("type").getValue() !== "rectangle"
  ) {
    return undefined;
  }
  const label = shapeNodeElem[0]
    .getChildren("NodeLabel", GRAPHML_NAMESPACE)
    .map((child) => child.getText())
    .filter((t) => t.trim().length > 0)
    .join(" ")
    .replace("\n", " ");
  return { id, label };
}

function readGraphMLEdge(edgeElem) {
  const id = edgeElem.getAttribute("id").getValue();
  const source = edgeElem.getAttribute("source").getValue();
  const target = edgeElem.getAttribute("target").getValue();
  if (source === target) {
    return undefined;
  }
  const edge = edgeElem
    .getChildren()
    .filter((child) => child.getChildren().length > 0)
    .map((child) => child.getChildren()[0])[0];
  const edgeType = edge
    .getChild("LineStyle", GRAPHML_NAMESPACE)
    .getAttribute("type")
    .getValue();
  if (edgeType !== "line" && edgeType !== "dashed") {
    return undefined;
  }
  const label = edge.getChild("EdgeLabel", GRAPHML_NAMESPACE).getText();
  return {
    id,
    source,
    target,
    type: edgeType === "line" ? "ControlAction" : "Feedback",
    label,
  };
}

function resolveControlStructureFromDrawio(document) {
  const root = document.getRootElement();
  const cells = root
    .getChild("diagram")
    .getChild("mxGraphModel")
    .getChild("root")
    .getChildren("mxCell");
  const nodes = resolveDrawioNodes(cells);
  const edges = resolveDrawioEdges(cells, nodes);
  return buildControlStructureFromEdgesAndNodes(edges, nodes);
}

function resolveDrawioNodes(cells) {
  const nodes = new Map();
  cells
    .filter((cell) => {
      const geometry = cell.getChild("mxGeometry");
      return (
        geometry !== null &&
        geometry.getAttribute("x") !== null &&
        geometry.getAttribute("width") !== null &&
        geometry.getAttribute("relative") === null
      );
    })
    .forEach((cell) => {
      const node = {
        id: cell.getAttribute("id").getValue(),
        label: parseLabelIfNecessary(cell.getAttribute("value").getValue()),
      };
      const geometry = cell.getChild("mxGeometry");
      node.x = Number(geometry.getAttribute("x").getValue());
      node.y = geometry.getAttribute("y")
        ? Number(geometry.getAttribute("y").getValue())
        : 0;
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
  cells
    .filter((cell) => isDrawioEdgeOrEdgeLabel(cell))
    .forEach((cell) => {
      const id = cell.getAttribute("id").getValue();
      let edge;
      if (cell.getAttribute("style").getValue().indexOf("edgeLabel;") !== -1) {
        const edgeId = cell.getAttribute("parent").getValue();
        if (!edges.has(edgeId)) {
          return;
        }
        edge = edges.get(edgeId);
        edge.label = parseLabelIfNecessary(
          cell.getAttribute("value").getValue(),
        );
      } else {
        const edge = { id };
        edge.type =
          cell.getAttribute("style").getValue().indexOf("dashed=1;") !== -1
            ? "Feedback"
            : "ControlAction";
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
        points.forEach((p) => {
          const x = Number(p.getAttribute("x").getValue());
          const y = Number(p.getAttribute("y").getValue());
          const matchingNode = Array.from(nodes.values()).find(
            (n) =>
              x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + n.height,
          );
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
  return (
    (cell.getAttribute("edge") !== null &&
      cell.getAttribute("edge").getValue() === "1") ||
    (cell.getAttribute("style") !== null &&
      cell.getAttribute("style").getValue().indexOf("edgeLabel;") !== -1)
  );
}

function getDrawioEdgePoints(geometry) {
  const mxPoints = geometry.getChildren("mxPoint") || [];
  const directChildren = mxPoints.filter(
    (p) =>
      p.getAttribute("as") !== null &&
      (p.getAttribute("as").getValue() === "sourcePoint" ||
        p.getAttribute("as").getValue() === "targetPoint"),
  );
  if (directChildren.length > 0) {
    return directChildren;
  } else if (
    geometry.getChild("Array") != null &&
    geometry.getChild("Array").getAttribute("as") !== null &&
    geometry.getChild("Array").getAttribute("as").getValue() === "points"
  ) {
    return geometry
      .getChild("Array")
      .getChildren("mxPoint")
      .filter((p) => p.getAttribute("as") !== null);
  }
  return [];
}

/**
 * This populates both the sheet for UCA definition as well as a helper control structure table in the CS sheet (will be used for generating loss scenarios).
 */
function generateControlStructureCells(controlStructure) {
  const ucaSheet = SpreadsheetApp.getActive().getSheetByName(UCA_SHEET_NAME);
  const csSheet = SpreadsheetApp.getActive().getSheetByName(CS_SHEET_NAME);
  let lastRow = UCA_SHEET_HEADER_ROW_COUNT + 1;
  Object.keys(controlStructure)
    .sort()
    .forEach((controller) => {
      const items = controlStructure[controller];
      ucaSheet.getRange(lastRow, 1).setValue(controller);
      csSheet.getRange(lastRow, 1).setValue(controller);
      const controllerRow = lastRow;
      items.forEach((item) => {
        const actionLabel = item.controlAction;
        const actions = actionLabel.split("\n");
        actions.forEach((a) => {
          const actionRange = ucaSheet.getRange(lastRow, ACTION_COLUMN);
          actionRange.setValue(a);
          actionRange.setVerticalAlignment("middle");
          actionRange.setWrap(true);
          actionRange.setBackground(NON_EDITABLE_BACKGROUND);
          const controlledProcessRange = ucaSheet.getRange(
            lastRow,
            CONTROLLED_PROCESS_COLUMN,
          );
          controlledProcessRange.setValue(item.controlledProcess);
          controlledProcessRange.setVerticalAlignment("middle");
          controlledProcessRange.setWrap(true);
          controlledProcessRange.setBackground(NON_EDITABLE_BACKGROUND);
          const ucaRange = ucaSheet.getRange(`D${lastRow}:G${lastRow}`);
          ucaRange.setValue("N/A");
          ucaRange.setHorizontalAlignment("center");
          ucaRange.setVerticalAlignment("middle");
          const constraintRange = ucaSheet.getRange(`H${lastRow}:K${lastRow}`);
          constraintRange.setValue("");

          const caRange = csSheet.getRange(lastRow, 2);
          caRange.setValue(a);
          caRange.setBackground(NON_EDITABLE_BACKGROUND);
          caRange.setWrap(true);
          const cpRange = csSheet.getRange(lastRow, 3);
          cpRange.setValue(item.controlledProcess);
          cpRange.setBackground(NON_EDITABLE_BACKGROUND);
          cpRange.setWrap(true);
          lastRow++;
        });
      });
      const controllerRange = ucaSheet.getRange(
        `A${controllerRow}:A${lastRow - 1}`,
      );
      controllerRange.setVerticalAlignment("middle");
      controllerRange.mergeVertically();
      controllerRange.setBackground(NON_EDITABLE_BACKGROUND);
      controllerRange.setWrap(true);
      const csControllerRange = csSheet.getRange(
        `A${controllerRow}:A${lastRow - 1}`,
      );
      csControllerRange.setVerticalAlignment("middle");
      csControllerRange.setBackground(NON_EDITABLE_BACKGROUND);
      csControllerRange.mergeVertically();
      csControllerRange.setWrap(true);
    });
}
