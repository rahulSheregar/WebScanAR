const router = require("express").Router();

const modelviewService = require("../services/modelviewService");

router.ws("/download/mesh/:title", (ws, req) => {
  modelviewService.downloadMesh(ws, req);
});

router.ws("/download/texture/:title", (ws, req) => {
  modelviewService.downloadTexture(ws, req);
});

router.ws("/download/:title", (ws, req) => {
  modelviewService.downloadZippedFiles(ws, req);
});

router.ws("/check/:title", (ws, req) => {
  modelviewService.isModelReady(ws, req);
});

module.exports = router;
