const router = require("express").Router();

const uploadService = require("../services/uploadService");

router.ws("/", (ws, req) => {
  uploadService.init(ws, req);
});

router.post("/delete/:title", (req, res) => {
  uploadService.delete(req, res);
});

module.exports = router;
