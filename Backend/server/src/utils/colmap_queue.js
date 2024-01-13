let async = require("async");
let { exec } = require("shelljs");
let queue = async.queue(work, 1);
let completed = 0;
let count = 0;
let filename;

function work(item, cb) {
  exec(
    `python ../../scripts/ColmapIncremental-web.py --imagename ${item.options[0]} --workspace ${item.options[1]} --type ${item.options[2]}`,
    { async: true, silent: true },
    (_code, _stdout, stderr) => {
      if (stderr) {
        let err = Error("Colmap Error");
        err.code = "COLMAPERROR";
        cb(err);
      }
      filename = item.options[0];
      count += 1;
      if (queue.length() === 0) {
        completed = 1;
        count = 0;
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
    image_count: count,
    completed: completed,
  };
}

module.exports = { pushImage, checkStatus };
