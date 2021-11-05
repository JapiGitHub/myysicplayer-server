const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
const users = require("../models/users-db");
var fsasync = require("fs").promises;

//youtube / soundcloud downloader. näitä kannattaa päivitella usein, koska yt ja sc blokkailee noita välillä
const ytdl = require("ytdl-core");
const scdl = require("soundcloud-downloader").default;

//title to valid filename
var sanitize = require("sanitize-filename");

let folderContent;
async function loadFolder(folder) {
  folderContent = await fsasync.readdir(folder);
}

const login = (req, res) => {
  console.log("LOGIN ATTEMPT : ");
  console.log("usr : ", req.headers.username);

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
        const payload = attemptingUser.username;
        token = await JWT.sign({ payload }, process.env.JWT_SECRET, {
          expiresIn: 600000,
        });
        ok = true;
      }
    };

    checkPass().then(() => {
      if (ok) {
        res.status(200).json(token);
      } else {
        res.status(400).send("nope");
      }
    });
  }
};

const getList = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  const incomingToken = req.header("token");
  console.log("INCOMING TOKEN", incomingToken);

  await loadFolder("./bigplaylist");
  res.send(folderContent);
};

const getSong = (req, res) => {
  //tulee streamina. kun kattoo devtoolsin Networkista ni pitkät biisit ainakin lataa paloissa.
  //ja nyt lataa vain yhden biisin kerrallaan eikä kaikkia valmiiksi lol
  //<Sound componentissa reactissa on  autoLoad={false}
  res
    .status(200)
    .sendFile(path.join(__dirname + "/../bigplaylist/" + req.params.songfile));
};

const urlDownload = async (req, res) => {
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
    //https://api-auth.soundcloud.com/connect/session?client_id=ZyeUdda...i347q
    //client_id=ZyeUd...kXi347q

    //URL toimii myös lisähärpäkkeillä   esim url/biisi??in_system_playlist=personalized-tracks%3A%3Ausername%3A84915999
    //toimii jopa vaikka soudncloud biisi ois "donwloadable: false"
    const SOUNDCLOUD_URL = req.body.url;
    const CLIENT_ID = process.env.SOUNDCLOUD_API_KEY;

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

  //reactin päässä react lisää vaan songList[] stateen ton nimen, eli ei tarvi täältä päästä hakea folderContenttia uudestaan latauksen jälkeen.
};

module.exports = { login, getList, getSong, urlDownload };
