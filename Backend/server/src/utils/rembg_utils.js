const spawn = require("child_process").spawn;
let rembg_runner;

const executeRembg = (objectDirectory) => {
  rembg_runner = spawn(
    "rembg",
    [
      "p",
      "-m",
      "u2net",
      "-w",
      `${objectDirectory}images/`,
      `${objectDirectory}images_without_bg/`,
    ],
    { stdio: "inherit" }
  );
};

const killRembg = () => {
  rembg_runner.kill();
};

module.exports = { executeRembg, killRembg };
