require("dotenv").config();
var http = require("http");
var fileSystem = require("fs");
var fsasync = require("fs").promises;
(path = require("path")), (util = require("util"));
const express = require("express");
const app = express();
//cross origin
var cors = require("cors");

//security / login / jwt
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
let users = require("./users-db");
const url = require("url");
const checkAuth = require("./middleware/checkAuth");

//youtube / soundcloud downloader
const ytdl = require("ytdl-core");
const scdl = require("soundcloud-downloader").default;
//title to valid filename
var sanitize = require("sanitize-filename");

//uploadingiin tarvittavat
const multer = require("multer");
const fs = require("fs");
const { promisify } = require("util");
const pipeline = promisify(require("stream").pipeline);

//use EJS rendering for html
app.set("view engine", "ejs");

app.use(cors());
let auth = true;
let folderContent;

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
// parse application/json
app.use(express.json());

const port = 2000;
const hostname = "localhost";

async function loadFolder(folder) {
  folderContent = await fsasync.readdir(folder);
}
loadFolder("./bigplaylist");

/* doThe = async () => {
  if (
    await bcrypt.compare(
      "salasana",
      "$2b$10$zFehJiw167VKqbULXY1Ty.p4kScj89Y7EwTExDBhNLGE8g7nG1gXy"
    )
  ) {
    console.log("TOIMIII!!!!");
  } else {
    console.log("ei valid ", hashedPassword);
  }
};
doThe(); */

//PLAY SONG REQUEST
app.get(
  "/bigplaylist/:songfile",
  (req, res, next) => {
    //MIDDLEWARE AUTH CHECK
    console.log("-----");
    console.log("-----");
    console.log("MIDDLEWARE AUTH CHECK");
    console.error(req.query.token);
    let user;
    try {
      user = JWT.verify(req.query.token, process.env.JWT_SECRET);
      console.log("TOKEN VERIFIED ++ ", { user });
    } catch (error) {
      console.log(error);
      console.log("USER ::: ", { user });
      res.redirect("/login");
      //tää koittaa nyt tällä itseasiassa loginnata ja valittaa että headerissa ei löydy useria lol
      //response -> token fail -> laita react menemään login "sivulle"
      res.status(403).send("token NOT verified");
    }

    console.log("-----");
    console.log("-----");

    next();
  },
  (req, res) => {
    const options = {
      root: path.join(__dirname),
    };
    //toi taitaa tulle streamina koska kun kattoo devtoolsin Networkista niin pitkissä biiseissä ainakin lataa paloissa.
    //ja nyt lataa vain yhden biisin kerrallaan eikä kaikkia valmiiksi lol
    //<Sound componentissa reactissa on autoLoad={false}
    res.status(200).sendFile(`/bigplaylist/${req.params.songfile}`, options);
  }
);

//VAI TULEEKO SE AUTH CHECK TÄHÄN MYÖS  middlewarena?
//middleware: jos token not-ok, niin send biisilistan sijasta error viesti.
//jos reactin useEffecti ottaa vastaan biisilistan sijasta errorin, niin
//login sivu pärähtää esiin
app.get("/", checkAuth, async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  const incomingToken = req.header("token");
  console.log("INCOMING TOKEN", incomingToken);

  await loadFolder("./bigplaylist");
  //test
  res.send(folderContent);
});
//console.log("TYPE ::: ", typeof users.users[0].username); //string

//LOGIN
app.get("/login", (req, res) => {
  console.log("LOGIN ATTEMPT : ");
  console.log("usr :", req.headers.username);
  console.log("pass:", req.headers.password);

  const attemptingUser = users.users.find((user) => {
    return user.username === req.headers.username;
  });

  if (!attemptingUser) {
    res
      .status(400)
      .send(`no user ${attemptingUser} != ${req.headers.username}`);
  } else {
    let token;
    let ok = false;
    checkPass = async () => {
      if (await bcrypt.compare(req.headers.password, attemptingUser.password)) {
        console.log(req.headers.password, " = ", attemptingUser.password);

        //lähetä JWT clientille
        const payload = attemptingUser.username;
        token = await JWT.sign({ payload }, process.env.JWT_SECRET, {
          expiresIn: 600000,
        });
        ok = true;
      } else {
        res.status(400).send("not valid");
        console.log("ei valid ", req.headers.password);
      }
    };

    //DEBUG eli tää lähettää tän vaikka ei sais?
    checkPass().then(() => {
      if (ok) {
        res.status(200).json(token);
      } else {
        res.status(400).send("nope");
      }
    });
  }
});

//
//
//YOUTUBE / SOUNDCLOUD DOWNLOAD
app.post("/ytdl/", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  let validTitle;

  //YouTube
  const downloadFromYoutube = async () => {
    const ytInfo = await ytdl.getInfo(req.body.url);
    validTitle = sanitize(ytInfo.videoDetails.title);
    console.log("1 : ", validTitle);
    ytdl(req.body.url, {
      filter: "audioonly",
    }).pipe(fs.createWriteStream(`${__dirname}/bigplaylist/${validTitle}.mp3`));

    console.log("downloaded mp3 : ", ytInfo.videoDetails.title);
    res.status(200).send(`${sanitize(ytInfo.videoDetails.title)}.mp3`);
  };

  //soundcloud
  const downloadFromSoundCloud = async () => {
    //SOUNDCLOUD CLIENT ID:n saa näin : chrome dev tools -> Network -> Fetch/XMR -> sieltä löytyy toi headerseisstä
    //https://api-auth.soundcloud.com/connect/session?client_id=ZyeUddavtQufdSASlMNmlO6oGkXi347q
    //client_id=ZyeUddavtQufdSASlMNmlO6oGkXi347q

    //URL toimii myös lisähärpäkkeillä   esim url/biisi??in_system_playlist=personalized-tracks%3A%3Ajanne-kaarle-korkee%3A84915999
    //toimii jopa vaikka soudncloud biisi ois "donwloadable: false"
    const SOUNDCLOUD_URL = req.body.url;
    const CLIENT_ID = "ZyeUddavtQufdSASlMNmlO6oGkXi347q";

    console.log({ SOUNDCLOUD_URL });

    scdl.getInfo(SOUNDCLOUD_URL, CLIENT_ID).then((info) => {
      console.log(info.title);

      scdl
        .download(SOUNDCLOUD_URL)
        .then((stream) => {
          stream.pipe(
            fs.createWriteStream(
              `${__dirname}/bigplaylist/${sanitize(info.title)}.mp3`
            )
          );
        })
        .then(() => {
          res.status(200).send(`${sanitize(info.title)}.mp3`);
        });
    });
  };

  //AUTOMATIC CHOOSE YT / SC
  //tän vois varmaan tehdä fiksumminkin jollain URL-kirjastolla.
  //nyt joku vois injektoida serverille jotain jos se hämäis tota? esim pewnedlol.com/reverseShell.xyz?fake=youtube.com
  if (
    req.body.url.includes("https://youtube.com/") ||
    req.body.url.includes("https://www.youtube.com/") ||
    req.body.url.includes("https://youtu.be/")
  ) {
    console.log("recognized URL as youtube or youtu.be");
    await downloadFromYoutube();
  }

  if (
    req.body.url.includes("https://soundcloud.com/") ||
    req.body.url.includes("https://www.soundcloud.com/")
  ) {
    console.log("recognized URL as soundcloud");
    await downloadFromSoundCloud();
  }

  //reactin päässä react lisää vaan songList stateen ton nimen, eli ei tarvi täältä päästä hakea folderContenttia uudestaan latauksen jälkeen.
});

//
//upload from frontend disk
const upload = multer();
app.post("/upload/", upload.single("file"), async (req, res, next) => {
  //console.log("::BODY::", req.body);
  console.log("::FILE::", req.file);
  const { file } = req;
  const fileExt = file.detectedFileExtension;

  console.log("1::DETECTED FILE ::", fileExt);

  if (fileExt === ".webm" || fileExt === ".mp3" || fileExt === ".m4a") {
    console.log("2::DETECTED FILE ::", fileExt);
    console.log("succesful upload from front/rect : ", file.originalName);

    //next(new Error("invalid filetype. only .mp3, .webm and .m4a supported"));

    //DEBUG SANITIZE TÄHÄN
    validTitle = sanitize(file.originalName);

    await pipeline(
      file.stream,
      fs.createWriteStream(`${__dirname}/bigplaylist/${validTitle}`)
    );

    res.send(`file uploaded as ${validTitle}`);
  } else {
    //eli jos joku koittaa lähettää vaarallista tiedostoa joka on vaan muutettu .mp3:ksi, niin ei pääse läpi.
    console.log("wrong fileExtension type : ", fileExt);
    res.status(400).send("wrong file ext");
  }
});
//

app.listen(port, () => {
  console.log(`node server listening at http://localhost:${port}`);
});
