const JWT = require("jsonwebtoken");

tokenCheckUrlQuery = (req, res, next) => {
  //MIDDLEWARE AUTH CHECK from URL query
  console.log("-----");
  console.log("MIDDLEWARE AUTH CHECK from url query");
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
  next();
};

module.exports = tokenCheckUrlQuery;
