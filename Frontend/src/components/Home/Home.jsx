import { useEffect, useState, useRef } from "react";
import "./Home.css";
import Lottie from "react-lottie-player";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";

// config, data files
import lottieJson from "../../public/cube.json";

// components
import LargeButton from "../LargeButton/LargeButton";

const Home = () => {
  const [count, setCount] = useState(-1);
  const [clientTitle, setClientTitle] = useState("");
  const [images, setImages] = useState([]);
  const [totalImageCount, setTotalImageCount] = useState(-1);
  const [socket, setSocket] = useState(null);
  let navigate = useNavigate();

  const counterEle = useRef();
  const processBtn = useRef();
  const imageDisplayEle = useRef();
  const openCameraBtn = useRef();
  const selectedImagesEle = useRef();

  // animation timelines
  let tl1 = useRef();
  let tl2 = useRef();
  let tl3 = useRef();
  let tl4 = useRef();

  useEffect(() => {
    // after clicking next
    tl1.current = gsap.timeline({ defaults: { ease: "circ.out" } });
    tl1.current.paused(true);
    tl1.current.to(".seq", { y: 40, opacity: 0, stagger: 0.05 });
    tl1.current.fromTo(
      ".home__card",
      { scale: 0.9 },
      { scale: 1, duration: 0.7 }
    );
    tl1.current.fromTo(
      ".seq2",
      { opacity: 0 },
      {
        display: "block",
        opacity: 1,
        y: -20,
        duration: 1,
        stagger: 0.1,
      }
    );

    // error message
    tl2.current = gsap.timeline({ defaults: { ease: "circ.out" } });
    tl2.current.paused(true);
    tl2.current.to(".error-msg", {
      display: "block",
      y: 10,
      duration: 1,
    });

    // choose upload option
    tl3.current = gsap.timeline({ defaults: { ease: "circ.out" } });
    tl3.current.paused(true);
    tl3.current.to(".seq2", {
      display: "none",
      y: 20,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
    });

    tl3.current.fromTo(
      ".seq3",
      {
        y: 20,
        opacity: 0,
      },
      {
        display: "block",
        y: 0,
        opacity: 1,
        duration: 1,
        stagger: 0.1,
      }
    );

    // after clicking upload
    tl4.current = gsap.timeline({ defaults: { ease: "circ.out" } });
    tl4.current.paused(true);
    tl4.current.to(".seq4", {
      display: "none",
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
    });
    tl4.current.to(".home__card", {
      y: 40,
      height: "70vh",
      duration: 1,
    });
    tl4.current.fromTo(
      imageDisplayEle.current,
      {
        height: "0px",
      },
      {
        display: "block",
        height: "245px",
        duration: 1,
      }
    );
    tl4.current.fromTo(counterEle.current, { opacity: 0 }, { opacity: 1 });
  }, []);

  useEffect(() => {
    if (count > 0) {
      imageDisplayEle.current.src = images[count - 1];
      console.log(imageDisplayEle.current.src);
      counterEle.current.textContent = `Uploaded [${count}/${totalImageCount}] images`;
    }
    if (count > 0 && count === totalImageCount) {
      processBtn.current.style.display = "block";
    }
  }, [count]);

  const waitForOpenConnection = (socket) => {
    return new Promise((resolve, reject) => {
      var maxNumberOfAttempts = 10;
      var intervalTime = 200; // ms

      let currentAttempt = 0;
      let interval = setInterval(() => {
        if (currentAttempt > maxNumberOfAttempts - 1) {
          clearInterval(interval);
          reject(new Error("Maximum number of attempts exceeded."));
        } else if (socket.readyState === socket.OPEN) {
          clearInterval(interval);
          resolve();
        }
        currentAttempt++;
      }, intervalTime);
    });
  };

  const sendMessage = async (socket, msg) => {
    if (socket) {
      if (socket.readyState !== socket.OPEN) {
        try {
          await waitForOpenConnection(socket).then((res) => {
            socket.send(msg);
          });
        } catch (err) {
          console.error(err);
        }
      } else {
        socket.send(msg);
      }
    }
  };

  useEffect(() => {
    if (socket) {
      // Connection opened
      socket.onopen = () => {
        console.log("--- Connected to WS Server ---");
        counterEle.current.textContent = `Uploaded [0/${totalImageCount}] images`;
      };

      // listen for messages
      socket.onmessage = ({ data }) => {
        data = JSON.parse(data);
        sessionStorage.setItem("title", data.metadata.title);
        setCount(data.metadata.count);
        console.log("Message from server: ", data);
      };

      socket.onclose = () => {
        setSocket(socket);
      };

      socket.onerror = () => {
        alert("Failed to connect to WS server");
        counterEle.current.textContent = "Failed";
        navigate("/");
      };
    }
  }, [socket]);

  const connectToWSServer = () => {
    if (socket) {
      socket.onerror = socket.onopen = socket.onclose = null;
      socket.close();
      console.log("--- Closed existing connection to WS Server ---");
    }

    let tempSocket = new WebSocket(
      `ws://${import.meta.env.VITE_SERVER_URL}:${
        import.meta.env.VITE_SERVER_PORT
      }/upload?title=${clientTitle}`
    );
    setSocket(tempSocket);
    counterEle.current.textContentt = "Connecting to server...";
  };

  const getBase64 = (file, onLoadCallback) => {
    return new Promise(function (resolve, reject) {
      let reader = new FileReader();
      reader.onload = (e) => {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = () => {
    openCameraBtn.current.style.pointerEvents = "none";
    openCameraBtn.current.style.cursor = "default";
    openCameraBtn.current.style.opacity = 0.5;

    connectToWSServer();

    let files = selectedImagesEle.current.files;
    for (let i = 0; i < totalImageCount; i++) {
      getBase64(files[i]).then((res) => {
        setImages([...images, res]);
        sendMessage(socket, res);
      });
    }
  };

  const onNextClick = (e) => {
    e.preventDefault();
    setClientTitle(title.value.replace(/ /g, ""));
    if (clientTitle != undefined && clientTitle) {
      sessionStorage.setItem("name", clientTitle);
      tl1.current.play();
    } else {
      tl2.current.play();
    }
  };

  const onChooseScanClick = (e) => {
    e.preventDefault();
    if (clientTitle != undefined && clientTitle) {
      navigate("/scan");
    } else {
      alert("Please enter a name for the object");
    }
  };

  const onChooseUploadClick = (e) => {
    e.preventDefault();
    tl3.current.play();
  };

  const onSelectImagesClick = (e) => {
    e.preventDefault();
    setTotalImageCount(e.target.files.length);
    if (e.target.files.length > 0) {
      document.getElementById("upload-images").style.pointerEvents = "auto";
      document.getElementById("upload-images").style.cursor = "pointer";
      document.getElementById("upload-images").style.opacity = 1;
    } else {
      document.getElementById("upload-images").style.pointerEvents = "none";
      document.getElementById("upload-images").style.cursor = "default";
      document.getElementById("upload-images").style.opacity = 0.5;
    }
  };

  const onImageUploadClick = (e) => {
    e.preventDefault();
    tl4.current.play();
    handleImageUpload();
  };

  return (
    <div className="home__div">
      <div className="home__card">
        <div className="home__onstart">
          <Lottie
            animationData={lottieJson}
            speed={1}
            style={{ height: 300 }}
            loop
            play
          />
        </div>
        <h2>Web Model Scanner</h2>
        <label htmlFor="title" className="seq">
          Enter a title
        </label>
        <input
          type="text"
          className="seq"
          id="title"
          onChange={(e) => setClientTitle(e.target.value)}
        />
        <p className="error-msg seq">Please enter a title</p>
        <LargeButton
          to="#"
          _id="next-button"
          classNames="seq"
          clickFn={onNextClick}
          text="Next"
        />

        {/* After title */}
        <div className="home__inputDiv">
          <div className="home__inputButtons seq2">
            <LargeButton
              to="#"
              _id="camera"
              classNames="seq2"
              customStyles={{ marginTop: 15 }}
              _ref={openCameraBtn}
              clickFn={onChooseScanClick}
              text="Scan"
            />
            <LargeButton
              to="#"
              _id="upload"
              classNames="seq2"
              customStyles={{ marginTop: 15 }}
              clickFn={onChooseUploadClick}
              text="Upload Images"
            />
          </div>
          <div id="upload-div" className="seq3">
            <img ref={imageDisplayEle} id="image-display" />
            <input
              type="file"
              id="images"
              name="images"
              accept="image/png, image/jpeg"
              className="seq3 seq4"
              multiple
              ref={selectedImagesEle}
              onChange={onSelectImagesClick}
            />
            <LargeButton
              to="#"
              _id="upload-images"
              classNames="seq4"
              clickFn={onImageUploadClick}
              text="Upload"
            />
            <h4 id="counter" ref={counterEle}></h4>
            <LargeButton
              to="processing"
              _id="generate-model"
              _ref={processBtn}
              text="Generate Model"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
