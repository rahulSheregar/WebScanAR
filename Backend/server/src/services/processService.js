const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// utility functions
const colmap = require("../utils/colmap_queue");
const { parseMessage } = require("../utils/parseMessage.js");

const executeReconstruction = (ws, args, options) => {
  new Promise((resolve, reject) => {
    // remove old reconstruction files
    fs.rm(args[2] + "dense", { recursive: true, force: true }, (err) => {
      if (err) throw err;
    });
    let dataToSend;
    let currentStage;
    // run ColmapMvsPipeline-web.py
    const ocmmand = spawn("python", args, options);
    // collect data from script
    command.stdout.on("data", function (data) {
      dataToSend = parseMessage(data.toString());
      if (dataToSend) {
        ws.send(JSON.stringify(dataToSend));
        currentStage = dataToSend.metadata.stage;
        if (dataToSend.status === "FAILED") {
          reject("[process] (Reconstruction) FAILED");
        }
      }
    });
    command.on("close", (code) => {
      if (currentStage === "4.4") {
        // Reached the end of the pipelin, textured model is created.
        ws.send(
          JSON.stringify({
            status: "COMPLETED",
            metadata: { stage: "5", step: "reconstruction" },
            message: "Reconstruction Completed",
          })
        );
        resolve(
          `[process] (Reconstruction) child process close all stdio with code ${code}`
        );
      } else {
        // Pipeline failed at some stage.
        ws.send(
          JSON.stringify({
            status: "FAILED",
            metadata: { stage: "0", step: "reconstruction" },
            message: "Reconstruction failed",
          })
        );
        reject("[process] (Reconstruction FAILED");
      }
    });
  });
};

const processImages = async (objectDirectory, ws, method) => {
  let args;
  if (method === "upload") {
    args = [
      "Backend/server/scripts/ColmapMvsPipeline-web.py",
      `${objectDirectory}`, // input directory
      `${objectDirectory}output/`, // output directory
      "PINHOLE", // camera model
      "--steps",
      "0", // Colmap Feature Extraction
      "1", // Colmap Exhaustive Matcher
      "2", // Colmap Mapper
      "3", // Colmap Bundle Adjuster
      "4", // Colmap Undistorting Images
      "5", // Colmap Model COnverter
      "6", // Create MVS scene
      "7", // Densify point cloud
      "8", // Reconstruct the mesh
      "9", // Refine the mesh
      "10", // Texture the mesh
    ];
  } else {
    args = [
      "Backend/server/scripts/ColmapMvsPipeline-web.py",
      `${objectDirectory}`, // input directory
      `${objectDirectory}output/`, // output directory
      "PINHOLE", // camera model
      "--steps",
      "4", // Colmap Undistorting Images
      "5", // Colmap Model COnverter
      "6", // Create MVS scene
      "7", // Densify point cloud
      "8", // Reconstruct the mesh
      "9", // Refine the mesh
      "10", // Texture the mesh
    ];
  }

  // run the command in the object directory (all logs will be stored in the objectDirectory)
  let options = { cwd: objectDirectory };

  await executeReconstruction(ws, args, options)
    .then((res) => {
      console.log(res);
    })
    .catch((err) => console.log(err));
};

const retrieveImages = (objectDirectory, title, ws) => {
  new Promise((resolve, reject) => {
    Promise.all([
      fs.promises.access(objectDirectory, fs.constants.F_OK).catch((err) => {
        console.log(`${objectDirectory} not found.`);
        throw err;
      }),
      fs.promises
        .access(objectDirectory + "images/", fs.constants.F_OK)
        .catch((err) => {
          console.log(`${objectDirectory}images/ not found.`);
          throw err;
        }),
      fs.promises
        .access(objectDirectory + "images_without_bg/", fs.constants.F_OK)
        .catch((err) => {
          console.log(`${objectDirectory}images_without_bg/ not found.`);
          throw err;
        }),
    ])
      .then(() => {
        fs.readdir(objectDirectory + "images/", (err, files) => {
          if (err) throw err;

          if (files.length === 0) {
            // check if there are any images
            ws.send(
              JSON.stringify({
                status: "FAILED",
                metadata: { stage: "0", step: "get-images" },
                message: `ERROR - '${title}' Images folder is empty.`,
              })
            );
            reject();
          } else {
            // Images retrieved successfully
            console.log(`[process] Processing images for ${title}`);
            ws.send(
              JSON.stringify({
                status: "FOUND IMAGES",
                metadata: { stage: "1", step: "get-images" },
                message: "Retrieved images",
              })
            );
            resolve();
          }
        });
      })
      .catch(() => {
        reject();
      });
  });
};

const checkBackgroundRemovalStatus = (objectDirectory, ws) => {
  new Promise((resolve) => {
    let timer = setInterval(() => {
      // check number of images in both the folders
      let originalImagesCount, processedImagesCount;
      Promise.all([
        fs.promises.readdir(objectDirectory + "images/"),
        fs.promises.readdir(objectDirectory + "images_without_bg/"),
      ]).then((res) => {
        originalImagesCount = res[0].length;
        processedImagesCount = res[1].length;

        if (
          originalImagesCount > 0 &&
          processedImagesCount < originalImagesCount
        ) {
          // Background removal in process...
          ws.send(
            JSON.stringify({
              status: "PROCESSING",
              metadata: { stage: "2", step: "Removing background" },
              message: "Removing background",
            })
          );
        } else {
          // Background removal is done, resolve
          ws.send(
            JSON.stringify({
              status: "PROCESSING",
              metadata: { stage: "2", step: "Removing background" },
              message: "Removed background",
            })
          );
          clearInterval(timer);
          resolve();
        }
      });
    }, 500);
  });
};

const checkColmapStatus = async (objectDirectory, ws) => {
  // let the client know that images are being processed incrementally for sparse reconstruction
  ws.send(
    JSON.stringify({
      status: "PROCESSING",
      metadata: { stage: "3.1", step: "Colmap" },
      message: "Processing Images",
    })
  );
  // number of images to show progress '[x/iomageCount]'
  let imageCount;
  await fs.readdir(objectDirectory + "images/", (err, files) => {
    imageCount = files.length;
  });
  let timer = setInterval(() => {
    let status = colmap.checkStatus();
    if (status.images_left === 0 && status.completed === 0) {
      // Incremental colmap didn't start.
      // Images have been uploaded. run colmap on all the images now.
      clearInterval(timer);
      ws.send(
        JSON.stringify({
          status: "PROCESSING",
          metadata: { stage: "3.1", step: "Colmap" },
          message: "Creating sparse point cloud",
        })
      );
      processImages(objectDirectory, ws, "upload");
    } else {
      // Images were scanned. Colmap is already running incrementally for each image
      if (status.completed === 1) {
        // Incremental sparse reconstruction completed, proceed to remaining steps.
        clearInterval(timer);
        ws.send(
          JSON.stringify({
            status: "PROCESSING",
            metadata: { stage: "3.1", step: "Colmap" },
            message: "Creating sparse point cloud",
          })
        );
        processImages(objectDirectory, ws, "scan");
      } else {
        ws.send(
          JSON.stringify({
            status: "PROCESSING",
            metadata: { stage: "3.1", step: "Colmap" },
            message: `Processing Image : [${status.image_count}/${imageCount}]`,
          })
        );
      }
    }
  }, 1000);
};

module.exports.init = async (ws, req) => {
  console.log("[process] A new client Connected!");
  let title = req.query.title;
  let objectDirectory = path.join(__dirname, `../public/uploads/${title}/`);

  try {
    await retrieveImages(objectDirectory, title, ws)
      .then(() => {
        ws.send(
          JSON.stringify({
            status: "PROCESSING",
            metadata: { stage: "2", step: "Removing background" },
            message: "Removed background",
          })
        );
        checkColmapStatus(objectDirectory);
      })
      .catch(() => {
        console.log("Image retrieval failed");
        ws.send(
          JSON.stringify({
            status: "FAILED",
            metadata: { stage: "0", step: "get-images" },
            message: `ERROR - Images folder with '${title}' not found.`,
          })
        );
      });
  } catch (err) {
    console.log(`FAILED ${err ? ": " + err : ""}`);
  }
};

module.exports.getSparseModel = (req, res) => {
  const title = req.params.title;
  const file = path.join(
    __dirname,
    `../public/uploads/${title}/output/current_sparse.ply`
  );
  fs.access(file, fs.constants.F_OK, (err) => {
    if (err) {
      res.status(404).send("Cannot find model / yet to create");
    } else {
      console.log(`Transferring updated sparse point cloud for ${title}`);
      res.download(file);
    }
  });
};
