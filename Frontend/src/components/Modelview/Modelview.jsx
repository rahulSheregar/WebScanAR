import { useRef, useEffect } from "react";
import "./Modelview.css";
import * as THREE from "three";
import { ARButton } from "../../jsm/webxr/ARButton.js";
import { ArcballControls } from "../../jsm/controls/ArcballControls.js";
import { GLTFLoader } from "../../jsm/loaders/GLTFLoader.js";
import { GestureControls } from "../../jsm/controls/GestureControls.js";
import { GUI } from "dat.gui";
import Stats from "../../jsm/libs/stats.module.js";

const Modelview = () => {
  const gui = new GUI();
  const stats = new Stats();
  document.body.appendChild(stats.domElement);

  let title,
    container,
    camera,
    scene,
    renderer,
    reticle,
    pivot,
    current_object,
    controls,
    gestureControls,
    ARButtonElem,
    initialScale;
  let hitTestSource = null;
  let hitTestSourceRequested = false;
  let isPlaced = false;
  let scaleFactor = 1;

  const placeButton = useRef(null);
  const actionLinks = useRef(null);
  const contentDiv = useRef(null);
  const loader = useRef(null);

  let folderOptions;
  const arcballGui = {
    gizmoVisible: false,
    setArcballControls: function () {
      controls = new ArcballControls(camera, renderer.domElement, scene);
      controls.addEventListener("change", render);
      controls.setGizmosVisible(arcballGui.gizmoVisible);

      this.gizmoVisible = false;

      this.populateGui();
    },

    // populateGui: functions() {
    //     folderOptions.add(arcballGui, "gizmoVisible").name("show gizmos").onChange(function() {
    //         controls.setGizmosVisible(arcballGui.gizmoVisible)
    //     })
    // }
  };

  const arPlace = () => {
    if (reticle.visible) {
      current_object.visible = true;
      pivot.position.setFromMatrixPosition(reticle.matrix);
      // pivot.rotation.x = 5;
      isPlaced = true;
      reticle.visible = false;
      gestureControls.addEventListener("onefingermove", handleObjectRotation);
      gestureControls.addEventListener("twofingermove", handleObjectScale);
    }
  };

  const loadModel = (title) => {
    const manager = new THREE.LoadingManager();
    manager.onStart = function (url, itemsLoaded, itemsTotal) {
      console.log(
        "Started loading file: " +
          url +
          ".\nLoaded " +
          itemsLoaded +
          " of " +
          itemsTotal +
          " files."
      );
    };

    manager.addHandler(/\.png$/, {
      load(url, onLoad, onProgress, onError) {
        const texture = new THREE.TextureLoader().load(
          `http://localhost:4000/modelview/download/texture/${title}`
        );
        requestAnimationFrame(() => onLoad(texture));
        return texture;
      },
    });

    manager.onLoad = function () {
      console.log("Loading complete!");
    };

    manager.onProgress = function (url, itemsLoaded, itemsTotal) {
      console.log(
        "Loading file: " +
          url +
          ".\nLoaded " +
          itemsLoaded +
          " of " +
          itemsTotal +
          " files."
      );
    };

    manager.onError = function (url) {
      console.log("There was an error loading " + url);
    };

    console.log(`Retreiving ${title} model from the server`);
    loader.current.style.display = "block";
    let gltfLoader = new GLTFLoader(manager);
    gltfLoader.load(
      `https://localhost:4000/modelview/download/mesh/${title}`,
      function (glb) {
        loader.current.style.display = "none";
        current_object = glb.scene;
        current_object.scale.multiplyScalar(0.4);
        current_object.rotation.x = Math.PI / -1;
        initialScale = current_object.scale.clone();

        let box = new THREE.Box3().setFromObject(current_object);
        box.getCenter(current_object.position);
        current_object.position.multiplyScalar(-1);

        pivot = new THREE.Group();
        scene.add(pivot);
        pivot.add(current_object);

        // HELPERS
        // const axesHelper = new THREE.AxesHelper(5);
        // scene.add(axesHelper);
        // scene.add(new THREE.BoxHelper(current_object));

        render();
      },
      () => {},
      (e) => {
        // Model not found
        loader.current.style.display = "none";
        ARButtonElem.style.display = "none";
        alert(e);
      }
    );
  };

  const checkForTitle = async () => {
    title = sessionStorage.getItem("title");
    let reply = title;
    while ((reply === null || reply === "") && reply !== "cancel") {
      // No title in sessionStorage
      loader.current.style.display = "none";
      reply = prompt(
        "No model found for this session... Please enter the model title (or type 'cancel' to close the prompt)"
      ).replace(/ /g, "");
    }
    if (reply !== "cancel") {
      title = reply;
      let res = await fetch(`http://localhost:4000/modelview/check/${title}`);
      if (res.ok) {
        return { status: 1, msg: "Model found on server" };
      } else {
        return { status: 0, msg: "Model not found on server" };
      }
    } else {
      loader.current.style.display = "none";
      return { status: 0, msg: "-- Cancelled --" };
    }
  };

  const init = () => {
    actionLinks.current.style.dispaly = "flex";
    document.getElementById("download-link").addEventListener("click", () => {
      let urls = [
        `http://localhost:4000/modelview/download/mesh/${title}`,
        `http://localhost:4000/modelview/download/texture/${title}`,
      ];

      urls.forEach((url) => {
        let iframe = document.createElement("iframe");
        iframe.style.visibility = "collapse";
        document.body.append(iframe);

        iframe.contentDocument.write(
          `<form action="${url.replace(/\"/g, '"')} method="GET"></form>`
        );
        iframe.contentDocument.forms[0].submit();

        setTimeout(() => iframe.remove(), 2000);
      });
    });

    container = document.getElementById("enter-ar");

    // SCENE
    scene = new THREE.Scene();

    // LIGHTING
    scene.add(new THREE.HemisphereLight(0x443333, 0x222233, 4));

    // CAMERA
    const fov = 70;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.01;
    const far = 200;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 0, 2.5);

    // RENDERER
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPizelRatio(
      window.devicePixelRatio ? window.devicePixelRatio : 1
    );
    renderer.xr.enabled = true;
    // renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    loadModel(title);

    // CONTROLLERS
    folderOptions = gui.addFolder("Arcball parameters");
    arcballGui.setArcballControls();
    gestureControls = new GestureControls(renderer.domElement);

    // XR
    let options = {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: {
        root: contentDiv.current,
      },
    };

    container.appendChild(ARButton.createButton(renderer, options));

    ARButtonElem = document.getElementById("ARButton");
    ARButtonElem.addEventListener("click", () => {
      current_object.visible = false;
      contentDiv.current.classList.add("ar");
      actionLinks.current.style.display = "none";
    });

    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate;
    reticle.visible = false;
    scene.add(reticle);

    window.addEventListener("resize", onWindowResize);
  };

  const handleObjectRotation = (event) => {
    pivot.rotation.y += event.detail.positionChange.x * 5;
    pivot.rotation.x += event.detail.positionChange.y * 5;
  };

  const handleObjectScale = (event) => {
    scaleFactor *= 1 + event.detail.spreadChange / event.detail.startSpread;

    scaleFactor = Math.min(Math.max(scaleFactor, 0.3), 8);

    pivot.scale.x = scaleFactor * initialScale.x;
    pivot.scale.y = scaleFactor * initialScale.y;
    pivot.scale.z = scaleFactor * initialScale.z;
  };

  const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  const animate = () => {
    renderer.setAnimationLoop(render);
    requestAnimationFrame(animate);
    controls.update();
    stats.update();
  };

  const render = (timestamp, frame) => {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      if (hitTestSourceRequested === false) {
        session.requestReferenceSpace("viewer").then(function (referenceSpace) {
          session
            .requestHitTestSource({ space: referenceSpace })
            .then(function (source) {
              hitTestSource = source;
            });
        });

        session.addEventListener("end", function () {
          hitTestSourceRequested = false;
          hitTestSource = null;

          reticle.visible = false;
          isPlaced = false;

          let box = new THREE.Box3();
          box.setFromObject(current_object);
          box.getCenter(controls.target);

          contentDiv.current.classList.remove("ar", "stabilized");

          placeButton.current.style.display = "none";
          actionLinks.current.style.display = "flex";
          contentDiv.current.style.display = "";
          gestureControls.removeEventListener(
            "onefingermove",
            handleObjectRotation
          );
          gestureControls.removeEventListener(
            "twofingermove",
            handleObjectScale
          );
          current_object.visible = true;
        });

        hitTestSourceRequested = true;
      }

      if (hitTestSource && !isPlaced) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length) {
          const hit = hitTestResults[0];
          reticle.visible = true;
          reticle.matrix.fromArray(
            hit.getPost(referenceSpace).transform.matrix
          );
          placeButton.current.style.display = "block";
          contentDiv.current.classList.add("stabilized");
        } else {
          reticle.visible = false;
          placeButton.current.style.display = "none";
        }
      }
    }

    renderer.render(scene, camera);
  };

  useEffect(() => {
    checkForTitle().then((res) => {
      if (res.status) {
        init();
        animate();
      } else {
        alert(res.msg);
      }
    });
  }, []);

  return (
    <div className="modelview__div">
      <div id="content" ref={contentDiv} className="modelview__content">
        <div
          id="action-links"
          ref={actionLinks}
          className="modelview__actionLinks"
        >
          <a href="/" id="scan-again-link">
            Make anotehr one!
          </a>
          <a id="download-link">Click here to download the model</a>
        </div>
        <div id="enter-ar"></div>
        <a id="place-button" ref={placeButton} onClick={() => arPlace()}>
          PLACE
        </a>
        <div id="stabilization"></div>
        <div id="loader" ref={loader} className="modelview__loadersmall"></div>
      </div>
    </div>
  );
};

export default Modelview;
