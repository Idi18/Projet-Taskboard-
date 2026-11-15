// App provisoire : sera remplacée par la vraie app de A
const express = require("express");
const app = express();
const port = process.env.APP_PORT || 3000;

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send(`TaskBoard provisoire, servi par ${process.env.HOSTNAME || "local"}`);
});
app.get("/healthz", (req, res) => res.send("ok"));
app.get("/readyz", (req, res) => res.send("ready"));

app.listen(port, () => console.log(`TaskBoard écoute sur le port ${port}`));