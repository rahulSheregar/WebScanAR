const router = require("express").Router();

const processService = require("../services/processService");

router.ws("/", (ws, req) => {
  processService.init(ws, req);
});

router.post("/ongoingply/:title", (req, res) => {
  processService.getSparseModel(req, res);
});

module.exports = router;
