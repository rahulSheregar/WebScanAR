const router = require("express").Router();

const scanService = require("../services/scanService");

router.ws("/", (ws, req) => {
  scanService.init(ws, req);
});

router.post("/delete/:title", (req, res) => {
  scanService.delete(req, res);
});

module.exports = router;
