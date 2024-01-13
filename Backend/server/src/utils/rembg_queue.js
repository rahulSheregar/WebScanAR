const async = require("async");
const path = require("path");
const { exec } = require("shelljs");
let queue = async.queue(work, 1);
let completed = 0;
let filename;

function work(item, cb) {
  exec(
    `rembg i ${item.options[0]} ${item.options[1]}`,
    { async: true, silent: true },
    (_code, _stdout, stderr) => {
      if (stderr) {
        let err = Error("rembg Error");
        err.code = "REMBGERROR";
        cb(err);
      }
      filename = path.basename(item.options[0]);
      if (queue.length() === 0) {
        completed = 1;
      } else {
        completed = 0;
      }
      cb();
    }
  );
}

function pushImage(options, cb) {
  let work = {
    options: options,
  };
  queue.push(work, cb);
}

function checkStatus() {
  return {
    images_left: queue.length() + queue.running(),
    current_image: filename ? filename : null,
    image_count: filename
      ? filename.substring(filename.lastIndexOf("-") + 1).split(".")[0]
      : null,
    completed: completed,
  };
}

module.exports = { pushImage, checkStatus };
