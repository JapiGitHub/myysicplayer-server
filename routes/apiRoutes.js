const tokenCheckHeader = require("../middleware/tokenCheckHeader");
const tokenCheckUrlQuery = require("../middleware/tokenCheckUrlQuery");

//youtube / soundcloud downloader
const ytdl = require("ytdl-core");
const scdl = require("soundcloud-downloader").default;
//title to valid filename
var sanitize = require("sanitize-filename");

const apiController = require("../controllers/apiController");

const express = require("express");
const router = express.Router();

//uploadingiin tarvittavat
const multer = require("multer");
const upload = multer();
const fs = require("fs");
const { promisify } = require("util");
const pipeline = promisify(require("stream").pipeline);
//---------------------------------------------------------------------

//LOGIN
router.get("/login", apiController.login);

//get list of songs
//jos reactin useEffecti ottaa vastaan biisilistan sijasta errorin, niin login sivu pärähtää esiin
router.get("/getlist", tokenCheckHeader, apiController.getList);

//single song
router.get("/bigplaylist/:songfile", tokenCheckUrlQuery, apiController.getSong);

//
//NÄIHIN MYÖS CHECKHEADERIT middlewareen!
//YOUTUBE / SOUNDCLOUD DOWNLOAD
router.post("/ytdl/", apiController.urlDownload);

//upload to server from disk
router.post("/upload/", upload.single("file"), async (req, res, next) => {
  //console.log("::BODY::", req.body);
  console.log("::FILE::", req.file);
  const { file } = req;
  const fileExt = file.detectedFileExtension;

  console.log("1::DETECTED FILE ::", fileExt);

  //eli jos joku koittaa lähettää vaarallista tiedostoa joka on vaan muutettu .mp3:ksi, niin ei pääse läpi.
  if (fileExt === ".webm" || fileExt === ".mp3" || fileExt === ".m4a") {
    console.log("2::DETECTED FILE ::", fileExt);
    console.log("succesful upload from front/rect : ", file.originalName);

    validTitle = sanitize(file.originalName);

    await pipeline(
      file.stream,
      fs.createWriteStream(`${__dirname}/bigplaylist/${validTitle}`)
    );

    res.send(validTitle);
  } else {
    console.log("wrong fileExtension type : ", fileExt);
    res.status(400).send("wrong file ext");
  }
});

module.exports = router;
