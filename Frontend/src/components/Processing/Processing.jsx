import React from "react";
import "./Processing.css";
import * as THREE from "three";
import { OrbitControls } from "../../jsm/controls/OrbitControls.js";
import { PLYLoader } from "../../jsm/loaders/PLYLoader.js";

const Processing = () => {
  let startTime,
    camera,
    scene,
    renderer,
    width,
    height,
    controls,
    sparseModel,
    pivot;

  const stagesDiv = useRef();
  const cardDiv = useRef();
  const ARDiv = useRef();
  let headingText = useRef();
  let dots = useRef();
  let errorMsg = useRef();
  let statusText = document.createElement("h4");

  function parseTime(a) {
    let ms = parseInt((a % 1000) / 100),
      s = parseInt((a / 1000) % 60),
      m = parseInt((a / (1000 % 60)) % 60),
      h = parseInt((a / (1000 * 60 * 60)) % 24);
    return (
      (h < 10 ? "0" + h : h) +
      ":" +
      (m < 10 ? "0" + m : m) +
      ":" +
      (s < 10 ? "0" + s : s) +
      "." +
      ms
    );
  }

  function init() {
    width = cardDiv.current.clientWidth - 65;
    hegith = cardDiv.current.clientHeight - 200;

    // SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // LIGHTING
    scene.add(new THREE.HemisphereLight(0x443333, 0x222233, 4));

    // CAMERA
    const fov = 45;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.01;
    const far = 200;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 0, 2.5);

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    ARDiv.current.appendChild(renderer.domElement);

    // CONTROLS
    controls = new OrbitControls(camera, renderer.domElement, scene);
    controls.target.set(0, 0.5, 0);
    controls.update();
    controls.enablePan = true;
    controls.enableDamping = true;

    pivot = new THREE.Group();
    scene.add(pivot);

    window.addEventListener("resize", onWindowResize);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function onWindowResize() {
    width = cardDiv.current.clientWidth - 65;
    // height = cardDiv.current.clientHeight - 200;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function loadModel(title) {
    console.log(`Retreiving ${title} model from the server`);
    let loader = new PLYLoader();
    loader.load(
      `http://${import.meta.env.VITE_SERVER_URL}:${
        import.meta.env.VITE_SERVER_PORT
      }/process/ongoingply/${title}`,
      function (geometry) {
        "";
        ARDiv.current.style.display = "block";
        geometry.computeVertexNormals();
        let material = new THREE.PointsMaterial({
          size: 0.005,
          vertexColors: true,
        });
        let mesh = new THREE.Points(geometry, material);
        sparseModel = mesh;

        sparseModel.scale.multiplyScalar(5);
        sparseModel.position.multiplyScalar(-1);
        sparseModel.rotation.x = Math.PI / -1;

        // center the point cloud
        let box = new THREE.Box3().setFromObject(sparseModel);
        box.getCenter(controls.target);

        // add the point cloud to a pivot for rotation
        pivot.clear();
        pivot.add(sparseModel);
      }
    );
  }

  let timer;
  function checkSparseModel(title) {
    timer = setInterval(() => {
      // get sparse model from server
      loadModel(title);
    }, 3000);
  }

  function updateStatus(first = false, createNew = false) {
    if (!first) {
      stagesDiv.current.lastChild.classList.remove("in-progress");
      stagesDiv.current.lastChild.classList.add("done");
    }
    stagesDiv.current.appendChild(statusText);
    statusText.classList.add("in-progress");
    if (createNew) statusText = document.createElement("h4");
  }

  function logTime(stage) {
    console.log(
      `${stage} in `,
      parseTime(new Date().getTime() - startTime),
      " mins"
    );
    startTime = new Date().getTime();
  }

  const check_status = async () => {
    let title = sessionStorage.getItem("title");
    let socket = new WebSocket(
      `ws://${import.meta.env.VITE_SERVER_URL}:${
        import.meta.env.VITE_SERVER_PORT
      }/process?title=${title}`
    );

    init();
    animate();
    checkSparseModel();

    headingText.current.textContent = "Connecting to server";

    let resetBtn = document.createElement("a");
    resetBtn.href = "/";
    resetBtn.textContent = "Go back to home screen";
    let globalStartTime;

    socket.onopen = () => {
      console.log("--- Connected to WS Server ---");
      headingText.current.textContent = "Processing";
      startTime = new Date().getTime();
      globalStartTime = startTime;
    };

    socket.onclose = () => {
      socket = null;
    };

    socket.onerror = () => {
      headingText.current.textContent = "Failed to connect";
      dots.current.style.display = "none";
      errorMsg.current.textContent = "Refresh the page to try again";
      cardDiv.current.appendChild(resetBtn);
    };

    socket.onmessage = ({ data }) => {
      data = JSON.parse(data);
      let current_stage = parseFloat(data.metadata.stage);
      statusText.textContent = data.message;
      if (current_stage === 0) {
        // Reconstruction Failed
        clearInterval(timer);
        if (stagesDiv.current.lastChild) {
          // show the current stage as failed.
          stagesDiv.current.lastChild.classList.remove("in-progress");
          stagesDiv.current.lastChild.classList.add("failed");
        }
        headingText.current.textContent = "Failed";
        dots.current.style.display = "none";
        errorMsg.current.textContent = "Refresh the page to try again";
        cardDiv.current.appendChild(resetBtn);
        if (data.metadata.step === "get-images") {
          stagesDiv.current.appendChild(statusText);
          statusText.classList.add("failed");
        }
        socket.onerror = socket.onopen = socket.onclose = null;
        socket.close();
        console.log("--- Closed existing connection to WS Server ---");
      } else if (current_stage === 1) {
        // Retreived images
        logTime("Retreived images");
        updateStatus(true, true);
      } else if (current_stage === 2) {
        // Background Removal
        if (statusText.textContent === "Removing background") {
          // in progress
          updateStatus(false, false);
        } else {
          // done
          updateStatus(false, true);
        }
      } else if (current_stage >= 3 && current_stage < 4) {
        // colmap
        if (statusText.textContent === "Processing Images") {
          // 3.1
          logTime("Removed background of images");
          updateStatus(false, false);
        } else if (statusText.textContent === "Created Sparse Point Cloud") {
          // 3.1
          updateStatus(false, true);
        } else if (statusText.textContent === "Undistorting images") {
          // 3.3
          logTime("Generated camera poses");
          updateStatus(false, true);
        }
      } else if (current_stage >= 4 && current_stage < 5) {
        // openMVS
        clearInterval(timer);
        if (statusText.textContent === "Densify point cloud") {
          // 4.1
          logTime("Undistorted images");
          updateStatus(false, true);
        } else if (statusText.textContent === "Reconstructing the mesh") {
          // 4.2
          logTime("Created Dense Point Cloud");
          updateStatus(false, true);
        } else if (statusText.textContent === "Refine the mesh") {
          // 4.3
          logTime("Reconstructed mesh");
          updateStatus(false, true);
        } else if (statusText.textContent === "Texture the mesh") {
          // 4.4
          logTime("Refined mesh");
          updateStatus(false, true);
        }
      } else if (current_stage === 5) {
        // DONE
        logTime("Textured mesh");
        console.log(
          "Reconstruction took ",
          parseTime(new Date().getTime() - globalStartTime),
          " mins"
        );
        stagesDiv.current.lastChild.classList.remove("in-progress");
        stagesDiv.current.lastChild.classList.add("done");

        headingText.current.textContent = "Completed";
        dots.current.style.display = "none";

        let viewLink = document.createElement("a");
        viewLink.setAttribute("href", "modelview");
        viewLink.textContent = "Click here to view the model";
        cardDiv.current.appendChild(viewLink);
      }
    };
  };

  useEffect(() => {
    check_status();
  }, []);

  return (
    <div className="processing__div">
      <div className="processing__card" ref={cardDiv}>
        <div className="processing__header">
          <h2 id="processing" ref={headingText}>
            Processing
          </h2>
          <h2 id="dots" ref={dots}>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </h2>
        </div>

        <h5 ref={errorMsg}>*Please do not refresh the page*</h5>
        <div id="enter-ar" ref={ARDiv}></div>
        <div className="processing__stages" id="stages" ref={stagesDiv}></div>
      </div>
    </div>
  );
};

export default Processing;
