const JWT = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  const token = req.header("token");

  console.log("middleware auth check: ", token);

  //check if token is given in header x-auth-token
  if (!token) {
    res.status(400).json({
      errors: [
        {
          msg: "no token found",
        },
      ],
    });
  }

  //verfiy the token. returns payload(JWT 2/3 osio) eli meidän tilanteessa username ja expiresIn
  //koska toi voi myös returnata errorin, niin try catch nappaa sen
  try {
    let user = await JWT.verify(token, process.env.JWT_SECRET);
    console.log("JWT verify SUCCESS");
    console.log({ user });

    req.user = user.username;
    next();
  } catch (err) {
    console.log(err);

    res.status(400).json({
      errors: [
        {
          msg: "token didnt pass verification",
        },
      ],
    });
  }
};
