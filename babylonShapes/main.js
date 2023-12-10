import * as BABYLON from "@babylonjs/core";
import earcut from "earcut";
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas);

//creating scene
const createScene = function () {
  const scene = new BABYLON.Scene(engine);

  //default camera
  //scene.createDefaultCameraOrLight(true, false, true);

  //creating camera
  const camera = new BABYLON.ArcRotateCamera(
    "Camera",
    -Math.PI / 2,
    Math.PI / 4,
    4,
    BABYLON.Vector3.Zero()
  );
  //attaching light to the camera
  camera.attachControl(canvas, true);
  const light = new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(1, 1, 0)
  );

  //creating the ground
  const ground = BABYLON.MeshBuilder.CreateGround("", {
    height: 2,
    width: 2,
    subdivisions: 20,
  });
  //creating the ground wire frame
  ground.material = new BABYLON.StandardMaterial();
  ground.material.wireframe = true;

  //variable declarations
  let mode = null;
  let drawingVertices = [];
  let extrudedShape = null;
  const extrusionHeight = 0.1; // Fixed extrusion height
  let moveModeEnabled = false;
  let selectedVertex = null;

  //importing draw button enter draw mode to add points to create the shape
  const drawButton = document.getElementById("drawButton");
  drawButton.addEventListener("click", function () {
    console.log("draw");
    setMode("draw");
  });

  //importing extrude button to start the extrudeShape process
  const extrudeButton = document.getElementById("extrudeButton");
  extrudeButton.addEventListener("click", function () {
    extrudeShape(scene);
  });

  //importing move button for the move mode
  const moveButton = document.getElementById("moveButton");
  moveButton.addEventListener("click", function () {
    console.log("move mode");
    drawButton.disabled = true;
    vertexEditButton.disabled = true;
    setMode("move");
  });

  //importing edit button for the vertexeditmode
  const vertexEditButton = document.getElementById("vertexEditButton");
  vertexEditButton.addEventListener("click", function () {
    console.log("Vertex Edit");
    setMode("vertexEdit");
  });

  //handle left click events to draw points, select extruded shape and vertex to edit
  canvas.addEventListener("click", function (event) {
    if (mode === "draw" && event.button === 0) {
      // Left-click to add points
      drawPoint(event);
    } else if (mode === "move" && event.button === 0) {
      selectExtrudedShape(scene, event.clientX, event.clientY);
    } else if (mode === "vertexEdit" && event.button === 0) {
      selectVertex(scene);
    }
  });

  //handle right click mouse event to complete the exit move, edit and draw action
  canvas.addEventListener("contextmenu", function (event) {
    event.preventDefault(); // Prevent the default context menu
    if (mode === "draw") {
      // Right-click to complete the shape
      completeShape(scene);
      setMode("");
    } else if (mode === "move") {
      // Right-click to complete the shape
      releaseExtrudedShape();
      setMode("");
    } else if (mode === "vertexEdit") {
      releaseSelectedVertex();
      setMode("");
    }
  });

  //handle the mousemove event for moving the extruded shapes and editing the vertex
  canvas.addEventListener("mousemove", function (event) {
    if (moveModeEnabled && extrudedShape) {
      moveExtrudedShape(scene, event.clientX, event.clientY);
    }
    if (mode === "vertexEdit" && selectedVertex) {
      moveSelectedVertex(scene, event.clientX, event.clientY);
    }
  });

  // release the vetex
  function releaseSelectedVertex() {
    selectedVertex = null;
    drawButton.disabled = false;
  }

  //Logic not working to edit vertex
  function moveSelectedVertex(scene, clientX, clientY) {
    let pickInfo = scene.pick(clientX, clientY);
    if (pickInfo.hit && selectedVertex) {
      selectedVertex.x = pickInfo.pickedPoint.x;
      selectedVertex.y = pickInfo.pickedPoint.y;

      const vertexIndex = drawingVertices.findIndex((v) =>
        v.equals(selectedVertex)
      );
      console.log(vertexIndex);

      if (vertexIndex !== -1) {
        // Get the current vertex positions
        const positions = extrudedShape.getVerticesData(
          BABYLON.VertexBuffer.PositionKind
        );
        // Calculate the starting index in the positions array for the selected vertex
        const startIndex = vertexIndex * 3;
        // Update the position of the selected vertex
        positions[startIndex] = selectedVertex.x;
        positions[startIndex + 1] = selectedVertex.y;
        positions[startIndex + 2] = selectedVertex.z;
        // Update the mesh with the modified vertex positions
        extrudedShape.updateVerticesData(
          BABYLON.VertexBuffer.PositionKind,
          positions
        );
      }
    }
  }
  //Select the vertex to edit
  function selectVertex(scene) {
    let pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && pickResult.pickedMesh === extrudedShape) {
      selectedVertex = pickResult.pickedPoint;
    }
  }

  //Select the extruded shape to move
  function selectExtrudedShape(scene, clientX, clientY) {
    let pickResult = scene.pick(clientX, clientY);
    if (pickResult.hit && pickResult.pickedMesh === extrudedShape) {
      moveModeEnabled = true;
    }
  }

  //Move the clicked extruded shape
  function moveExtrudedShape(scene, clientX, clientY) {
    let pickInfo = scene.pick(clientX, clientY);
    if (pickInfo.hit) {
      extrudedShape.position.x = pickInfo.pickedPoint.x;
      extrudedShape.position.y = pickInfo.pickedPoint.y;
    }
  }

  //On rightclick/context menu release the picked shape
  function releaseExtrudedShape() {
    moveModeEnabled = false;
    drawButton.disabled = false;
    vertexEditButton.disabled = false;
  }

  //pust the vertices for creating 2d shapes
  function drawPoint(event) {
    let pickResult = scene.pick(event.clientX, event.clientY);
    if (pickResult.hit) {
      let vertex = pickResult.pickedPoint;
      drawingVertices.push(vertex);
    }
  }

  // create the shape using the drawing vertices
  function completeShape(scene) {
    if (drawingVertices.length < 3) {
      // Need at least two points to form a shape
      return;
    }
    // Create a line mesh based on drawingVertices
    var lines = BABYLON.MeshBuilder.CreateLines(
      "lines",
      { points: [...drawingVertices, drawingVertices[0]], updatable: true },
      scene
    );
    // Optional: Customize the material for the lines
    var material = new BABYLON.StandardMaterial("lineMaterial", scene);
    material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red color
    lines.material = material;

    //UI cues to know which operation is active
    moveButton.disabled = false;
    extrudeButton.disabled = false;
    drawButton.disabled = true;
    vertexEditButton.disabled = false;
  }

  // extruding the drawn shape extrusionHeight=0.1
  function extrudeShape(scene) {
    if (drawingVertices.length >= 2) {
      // Extrude the shape
      extrudedShape = BABYLON.MeshBuilder.ExtrudePolygon(
        "extrudedShape",
        {
          shape: drawingVertices,
          depth: extrusionHeight,
        },
        scene,
        earcut
      );
      drawButton.disabled = false;
      extrudeButton.disabled = true;
      // Reset drawingVertices

      // let dragBehavior = new PointerDragBehavior({
      //   dragAxis: new BABYLON.Vector3(1, 0, 1),
      // });
      // extrudedShape.addBehavior(dragBehavior);
      // drawingVertices = [];
    }
  }

  // Function to set the current mode
  function setMode(newMode) {
    mode = newMode;
  }
  return scene;
};

//creating the scene
const scene = createScene();
engine.runRenderLoop(function () {
  scene.render();
});

// Avoid stretching of the scene
window.addEventListener("resize", function () {
  engine.resize();
});
