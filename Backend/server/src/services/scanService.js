const fs = require("fs");
const path = require("path");
const clc = require("cli-color");
const chokidar = require("chokidar");

// utility functions
const colmap = require("../utils/colmap_queue");
const { executeRembg } = require("../utils/rembg_utils");

// for colored output
const colors = {
  connection: clc.greenBright,
  info: clc.black.bgWhite,
  rembg: clc.blueBright,
  colmap: clc.yellowBright,
  error: clc.red,
};

let global_ws = null;

const watchFolder = (objectDir, type) => {
  // watch for new images and remove background
  if (type === "subject") executeRembg(objectDir);
  let imagesFolder =
    type === "subject"
      ? objectDir + "images_without_bg/"
      : objectDir + "images/";
  // watch the folder wher eimages without background are stores
  // add the images to colmap queue
  chokidar.watch(imagesFolder).on("add", (event, path) => {
    let filename = event.split("/").slice(-1)[0];
    // images after background removal are added to colmap queue
    console.log(
      colors.colmap(`[scan] (ColmapIncremental) Adding ${filename} to queue`)
    );
    // push the new image to the colmap queue
    colmap.pushImage([filename, objectDir, type], function (err) {
      if (err) {
        // handle it here. *should we even handle this in a callback?*
        // implemented temporary fix.
        console.log("[scan] (ColmapIncremental failed.");
        if (global_ws) {
          global_ws.send(
            JSON.stringify({
              status: "FAILED",
              metadata: { error: err },
              message: "Colmap failed, please try again.",
            })
          );
          // stop receiving images
          global_ws.close();
          // stop remb
          // stop colmap
        }
      } else {
        console.log(
          colors.colmap(`[scan] (ColmapIncremental) ${filename} processed.`)
        );
      }
    });
  });
};

module.exports.init = async (ws, req) => {
  console.log(colors.connection("[scan] A new client connected!"));
  let message = "Ready to receive images.";
  global_ws = ws;
  let title = req.query.title + new Date().toISOString().replace(/:/g, "-");
  let type = req.query.type;
  ws.send(
    JSON.stringify({ status: "CONNECTED", metadata: { title }, message })
  );

  let count = 0;

  let objectDirectory = path.join(__dirname, `../public/uploads/${title}/`);
  let imagesDirectory = objectDirectory + "images/";
  let noBackgroundDirectory = objectDirectory + "images_without_bg/";
  fs.promises
    .mkdir(objectDirectory)
    .then(() =>
      Promise.all([
        fs.promises.mkdir(imagesDirectory),
        fs.promises.mkdir(noBackgroundDirectory),
      ])
    );
  ws.on("message", (message) => {
    count++;
    console.log(
      colors.info(`[scan] - Received ${count} frames for '${title}' on server.`)
    );
    let data = message.toString().replace(/^data:image\/\w+;base64,/, "");
    let buf = Buffer.from(data, "base64");
    let filename = `${title}-${count}`;
    let mimeType = message.match(/[^:/]\w+(?=;|,)/)[0];
    fs.writeFile(
      imagesDirectory + `${filename}.${mimeType}`,
      buf,
      function (err) {
        if (err) throw err;
      }
    );
    message = `Received ${count} Frames.`;
    ws.send(
      JSON.stringify({
        status: "RECEIVING IMAGES",
        metadata: { title, count },
        message,
      })
    );
  });

  ws.on("close", () => {
    console.log(colors.connection("[scan] - A client disconnected"));
  });
};

module.exports.delete = async (req, res) => {
  let title = req.params.title;
  let objectDirectory = path.join(__dirname, `../public/uploads/${title}/`);
  await fs.rm(objectDirectory, { recursive: true, force: true }, (err) => {
    if (err) {
      console.log(colors.error("Folder could not be deleted."));
      res.sendStatus(500);
    } else {
      console.log(
        colors.info(`[scan] Reset requested. Deleted ${title} folder.`)
      );
      res.sendStatus(200);
    }
  });
};
