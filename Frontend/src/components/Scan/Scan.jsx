import { useEffect, useState, useRef } from "react";
import "./Scan.css";
import { Link, useNavigate } from "react-router-dom";
import segmentImg from "../../public/segment.png";
import flashFalseImg from "../../public/flash.png";

const Scan = () => {
  const torchButton = useRef();
  const recordButton = useRef();
  const resetButton = useRef();
  const generateButton = useRef();
  const imageCountBadge = useRef();
  const segCanvas = useRef();
  const webcamVideoEl = useRef();
  const displayCanvasEl = useRef();
  const scanMain = useRef();
  const loader = useRef();

  let warmedUp;
  let navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [displayCtx, setDisplayCtx] = useState(null);
  const [socket, setSocket] = useState(null);
  const [segmentModel, setSegmentModel] = useState(null);
  const [segmentCtx, setSegmentCtx] = useState(null);
  const [imageBitmap, setImageBitmap] = useState(null);
  const [track, setTrack] = useState(null);
  const [isSegment, setIsSegment] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [toggleTorch, setToggleTorch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const updateButtonStyles = () => {
    // record button
    recordButton.current.style.display = "block";
    recordButton.current.style.pointerEvents = "none";
    recordButton.current.style.cursor = "default";
    recordButton.current.style.opacity = 0.5;

    // reset button
    resetButton.current.style.display = "block";
    resetButton.current.style.pointerEvents = "none";
    resetButton.current.style.cursor = "default";
    resetButton.current.style.opacity = 0.5;
  };

  const clickImage = async () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("clicked frame || uploading to WS server");
      displayCanvasEl.current.width = imageBitmap.width;
      displayCanvasEl.current.hegiht = imageBitmap.height;
      displayCtx.drawImage(imageBitmap, 0, 0);
      let dataURI = displayCanvasEl.current.toDataURL("image/jpeg");
      socket.send(dataURI);
      imageCountBadge.current.textContent++;
    } else {
      console.log("Waiting for connection to be established");
    }
  };

  const prepareSegmentation = async () => {
    warmedUp = false;
    let tempSegmentModel = await tfTask.ImageSegmentation.Deeplab.TFJS.oad({
      backend: "webgl",
    });
    setSegmentModel(tempSegmentModel);
    setSegmentCtx(segCanvas.current.getContext("2d"));
  };

  const segmentFrame = async () => {
    // Warm up if needed. (Runs only the first time)
    if (imageBitmap && segmentModel) {
      if (!warmedUp) {
        await segmentModel.predict(imageBitmap);
        warmedUp = true;
      }
      let result = await segmentModel.predict(imageBitmap);
      renderCanvas(result);
    }
  };

  const renderCanvas = (result) => {
    if (isSegment && segmentCtx) {
      console.log("Rendering segmentation on canvas");
      segCanvas.current.width = result.width;
      segCanvas.current.height = result.height;
      segmentCtx.clearRect(0, 0, result.width, result.height);
      segmentCtx.putImageData(
        new ImageData(result.segmentationMap, result.width, result.height),
        0,
        0
      );
    }
  };

  const setupCamera = async () => {
    await navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: "environment", // for rear camera in mobile
          width: { idea: 1920 },
          height: { ideal: 1080 },
          // frameRate: {ideal : 2}
        },
      })
      .then((stream) => {
        setTrack(stream.getVideoTracks()[0]);
        let imageCapture = new ImageCapture(stream.getVideoTracks()[0]);
        webcamVideoEl.current.srcObject = stream;
        webcamVideoEl.current.play();
        prepareSegmentation();

        async function processFrame(now, metadata) {
          if (imageCapture) {
            let tempImageBitmap = await imageCapture.grabFrame();
            setImageBitmap(tempImageBitmap);
          }
          webcamVideoEl.current?.requestVideoFrameCallback(processFrame);
        }
        webcamVideoEl.current.requestVideoFrameCallback(processFrame);
      })
      .catch((err) => console.error(err));
  };

  const connectToWSServer = async () => {
    resetButton.current.style.pointerEvents = "none";
    resetButton.current.style.cursor = "default";
    resetButton.current.style.opacity = 0.5;
    recordButton.current.style.pointerEvents = "none";
    recordButton.current.style.cursor = "default";
    recordButton.current.style.opacity = 0.5;
    generateButton.current.style.display = "none";
    imageCountBadge.current.style.display = "none";
    imageCountBadge.current.textContent = null;

    if (socket) {
      socket.onerror = socket.onopen = socket.onclose = null;
      socket.close();
      console.log("--- Closed existing connection to WS Server ---");
    }

    let name = sessionStorage.getItem("name");
    let tempSocket = new WebSocket(
      `ws://${import.meta.env.VITE_SERVER_URL}:${
        import.meta.env.VITE_SERVER_PORT
      }/scan?title=${name}`
    );
    setSocket(tempSocket);
  };

  const segmentation = async () => {
    await segmentFrame();
  };

  const main = async () => {
    await setupCamera();
    updateButtonStyles();
    await connectToWSServer();
    let tempDisplayCtx = displayCanvasEl.current.getContext("2d");
    setDisplayCtx(tempDisplayCtx);
  };

  useEffect(() => {
    main();
  }, []);

  useEffect(() => {
    if (socket) {
      // Connection opened
      socket.onopen = () => {
        console.log("--- Connected to WS Server ---");
        scanMain.current.classList.remove("blur");
        loader.curent.style.display = "none";
        resetButton.current.style.pointerEvents = "auto";
        resetButton.current.style.cursor = "pointer";
        resetButton.current.style.opacity = 1;
        recordButton.current.style.pointerEvents = "auto";
        recordButton.current.style.cursor = "pointer";
        recordButton.current.style.opacity = 1;
        imageCountBadge.current.style.display = "block";
        imageCountBadge.current.textContent = 0;
      };

      // Listen for messages
      socket.onmessage = ({ data }) => {
        data.JSON.parse(data);
        if (data.metadata && data.metadata.title) {
          setTitle(data.metadata.title);
          sessionStorage.setItem("title", data.metadata.title);
        }
        console.log("Message from server: ", data);
      };

      socket.onclose = () => {
        setSocket(null);
      };

      socket.onerror = () => {
        alert("Failed to connect to WS server");
        navigate("/");
      };
    }
  }, [socket]);

  useEffect(() => {
    // Torch button
    if (track && track.getCapabilities().torch) {
      torchButton.current.style.display = "block";
    }
    track?.applyConstraints({
      advanced: [{ torch: toggleTorch }],
    });
  }, [toggleTorch, track]);

  useEffect(() => {
    if (isSegment) {
      console.log("SEGMENTATION : ON");
    } else {
      console.log("SEGMENTATION : OFF");
      segmentCtx?.clearRect(
        0,
        0,
        segCanvas.current.width,
        segCanvas.current.height
      );
    }
  }, [isSegment]);

  const [currentCount, setCount] = useState(0);
  const previousCount = useRef(currentCount);
  const timer = () => setCount(currentCount + 1);

  useEffect(() => {
    if (isSegment) {
      segmentation();
    }
    if (isRecording && previousCount.current !== currentCount) {
      clickImage();
      previousCount.current = currentCount;
    }
  }, [imageBitmap]);

  useEffect(() => {
    let recordingText = recordButton.current.getElementsByTagName("span")[1];
    if (isRecording) {
      console.log("RECORDING : ON");
      // Button attributes
      resetButton.current.style.pointerEvents = "none";
      resetButton.current.style.cursor = "default";
      resetButton.current.style.opacity = 0.5;
      recordingText.textContent = "STOP";
      recordButton.current.style.backgroundColor = "red";
      recordButton.current.style.boxShadow =
        "10px 10px 40px rgb(255, 209, 209)";
      generateButton.current.style.display = "none";
    } else {
      console.log("RECORDING : OFF");
      // Button attributes
      resetButton.current.style.pointerEvents = "auto";
      resetButton.current.style.cursor = "pointer";
      resetButton.current.style.opacity = 1;
      recordingText.textContent = "START";
      recordButton.current.style.backgroundColor = "white";
      recordButton.current.style.color = "black";
      recordButton.current.style.boxShadow =
        "10px 10px 40px rgb(219, 211, 255)";
      generateButton.current.style.display = "block";
    }
  }, [isRecording]);

  useEffect(() => {
    const reset = async () => {
      if (confirm("Are you sure you want to reset?") == true) {
        fetch(
          `http://${import.meta.env.VITE_SERVER_URL}:${
            import.meta.env.VITE_SERVER_PORT
          }/scan/delete/${title}`,
          { method: "POST" }
        );
        await connectToWSServer();
      }
    };
    if (isReset) {
      reset().catch(console.error);
      setIsReset(false);
    }
  }, [isReset]);

  return (
    <div className="scan__div">
      <div className="scan__main blur" ref={scanMain}>
        <img
          className="scan__icon flashlight"
          src={flashFalseImg}
          ref={torchButton}
          onClick={() => setToggleTorch((prevValue) => !prevValue)}
        />
        <img
          className="scan__icon segment"
          src={segmentImg}
          onClick={() => setIsSegment((prevValue) => !prevValue)}
        />
        <div className="scan__actionButtons">
          <a
            id="reset-button"
            ref={resetButton}
            onClick={() => setIsReset(true)}
          >
            RESET
          </a>
          <a
            ref={recordButton}
            onClick={() => {
              setIsRecording((prevValue) => !prevValue);
            }}
            id="record-button"
          >
            <span id="image-count-badge" ref={imageCountBadge}></span>
            <span>START</span>
          </a>
          <Link to="/processing" ref={generateButton}>
            DONE
          </Link>
        </div>
        <div className="scan__webcamDiv">
          <video id="webcamVideo" playsInline ref={webcamVideoEl}></video>
          <canvas id="segmentationCanvas" ref={segCanvas}></canvas>
          <canvas id="displayCanvas"> ref={displayCanvasEl}</canvas>
        </div>
      </div>
      <div className="scan__loader" id="loader" ref={loader}></div>
    </div>
  );
};

export default Scan;
