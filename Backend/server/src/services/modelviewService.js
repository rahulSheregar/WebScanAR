const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

module.exports.downloadMesh = (req, res) => {
  const title = req.params.title;
  const file = path.join(
    __dirname,
    `../public/uploads/${title}/output/mvs/scene_dense_mesh_refine_texture.glb`
  );
  console.log(`[modelview] Transferring Model ${title} mesh`);
  res.download(file);
};

module.exports.downloadTexture = (req, res) => {
  const title = req.params.title;
  const file = path.join(
    __dirname,
    `../public/uploads/${title}/output/mvs/scene_dense_mesh_refine_texture.png`
  );
  console.log(`[modelview] Transferring Model ${title} texture`);
  res.download(file);
};

module.exports.downloadZippedFiles = (req, res) => {
  const title = req.params.title;
  let zip = new JSZip();
  try {
    // add mesh to zip
    const meshFile = fs.readFileSync(
      path.join(
        __dirname,
        `../public/uploads/${title}/output/mvs/scene_dense_mesh_refine_texture.glb`
      )
    );
    zip.file("scene_dense_mesh_refind_texture.glb", meshFile);

    // add texture to zip
    const textureFile = fs.readFileSync(
      path.join(
        __dirname,
        `../public/uploads/${title}/output/mvs/scene_dense_mesh_refine_texture.png`
      )
    );
    zip.file("scene_dense_mesh_refind_texture.png", textureFile);

    zip
      .generateNodeStream({ type: "nodebuffer", streamFiles: true })
      .pipe(
        fs.createWriteStream(
          path.join(__dirname, `../public/uploads/${title}/output/result.zip`)
        )
      )
      .on("finish", function () {
        console.log(
          `[modelview] ${title}.zip created. Transferring to client.`
        );
        res.download(
          path.join(__dirname, `../public/uploads/${title}/output/result.zip`)
        );
      });
  } catch (err) {
    console.log(`[modelview] Error in transferring mesh zip : ${err}`);
  }
};

module.exports.isModelReady = (req, res) => {
  let title = req.params.title;
  let file = path.join(
    __dirname,
    `../public/uploads/${title}/output/mvs/scene_dense_mesh_refind_texture.png`
  );
  if (fs.existsSync(file)) {
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
};
