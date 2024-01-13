const path = require("path");
const fs = require("fs");
const clc = require("cli-color");

// utility functions
const { executeRembg } = require("../utils/rembg_utils");

// for colored output
const colors = {
  connection: clc.greenBright,
  info: clc.black.bgWhite,
  rembg: clc.blueBright,
  colmap: clc.yellowBright,
  error: clc.red,
};

module.exports.init = (ws, req) => {
  console.log(colors.connection("UPLOAD - A new client Connected!"));
  let message = "Ready to receive images.";
  let title = req.query.title + new Date().toISOString().replace(/:/g, "-");
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
      colors.info(`UPLOAD - Received ${count} image for '${title}' on server.`)
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
    // remove background
    executeRembg(objectDirectory, filename, mimeType, "UPLOAD", colors);
    message = `Received ${count} Images.`;
    ws.send(
      JSON.stringify({
        status: "RECEIVING IMAGES",
        metadata: { title, count },
        message,
      })
    );
  });

  ws.on("close", () => {
    console.log(colors.connection("UPLOAD - A client disconnected"));
  });
};

module.exports.delete = (req, res) => {
  let title = req.params.title;
  let objectDirectory = path.join(__dirname, `../public/uploads/${title}/`);
  fs.promises.rm(objectDirectory, { recursive: true, force: true });
  console.log(`UPLOAD - Reset requested. Deleted ${title} folder.`);
  res.sendStatus(200);
};
