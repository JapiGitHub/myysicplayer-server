require("dotenv").config();

(path = require("path")), (util = require("util"));
const express = require("express");
const app = express();
//cross origin
var cors = require("cors");

const routes = require("./routes/apiRoutes");

//laita tähän {vain sallitut corssit} kun oot päässy devauksessa siihen vaiheeseen et kannattaa
app.use(cors());

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const port = 2000;

app.use("/api", routes);

app.listen(port, () => {
  console.log(`node server listening at myysic.xyz : ${port}`);
});
