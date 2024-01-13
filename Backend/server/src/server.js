const express = require("express");
const cors = require("cors");

const port = process.env.PORT || 4000;

const app = express();
// eslint-disable-next-line no-unused-vars
const expressWs = require("express-ws")(app);

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// routes
app.use("/scan", require("./controler/scan"));
app.use("/upoad", require("./controler/upoad"));
app.use("/process", require("./controler/process"));
app.use("/modelview", require("./controler/modelview"));

process.once("SIGTERM", end);
process.once("SIGINT", end);

const server = app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

var lastSocketKey = 0;
var socketMap = {};
server.on("connection", function (socket) {
  // generate a new, unique socket-key
  let socketKey = ++lastSocketKey;
  // add socket when it is connected
  socketMap[socketKey] = socket;
  socket.on("close", function () {
    // remove socket when it is closed
    delete socketMap[socketKey];
  });
});

// clean-up on exit
function end() {
  console.log("Closing server");
  // loop through all sockets and destroy them
  Object.keys(socketMap).forEach(function (socketKey) {
    socketMap[socketKey].destory();
  });

  // after all the sockets are destroyed, we may close the server!
  server.close(() => {
    console.log("Server closed.");
    // exit gracefully
    process.exit(0);
  });
}
