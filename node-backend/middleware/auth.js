const passport = require("passport");
const { ExtractJwt, Strategy } = require("passport-jwt");
const User = require("../database/models/user");
const TokenBlacklist = require("../database/models/blacklist");

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
  passReqToCallback: true,
};

// step 2 and 3 can be optimized for performace in large scale deployment by following 
// Blacklist: Move it to Redis. Checking a key in Redis is ~0.1ms.
// User Identity: After the first DB lookup, store in redis the useruuid -> {id, name} either in redis or use Trust payload strategy
// trust the payload strategy better for eventual consistency

passport.use(
  new Strategy(opts, async (req, payload, done) => {
    console.log("retrieved payload", payload);
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(" ")[1];
      if (!token) {
        return done(null, false, { message: "Token missing" });
      }

      // --- STEP 2: Check the Blacklist ---
      const isBlacklisted = await TokenBlacklist.exists({ token });
      if (isBlacklisted) {
        return done(null, false, { message: "Token revoked" });
      }

      // --- STEP 3: If not blacklisted, proceed with user lookup ---
      const user = await User.findById(payload.id)
        .select('_id name')
        .lean();

      if (!user) {
        return done(null, false, { message: "User not found" });
      }

      return done(null, user);
    } catch (error) {
      console.error("Passport Strategy Error:", error);
      return done(error, false);
    }
  })
);

const authenticateJWT = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.userId = user._id;   // The Internal ObjectId for DB performance
    req.userName = user.name; // For denormalization (authorName field)

    const authHeader = req.headers.authorization;
    req.token = authHeader.split(" ")[1];

    next();
  })(req, res, next);
};

module.exports = { authenticateJWT };