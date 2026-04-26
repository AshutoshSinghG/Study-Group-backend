const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
        proxy: true
    },
        async (accessToken, refreshToken, profile, done) => {
            const newUser = {
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                avatar: profile.photos[0].value
            };

            try {
                let user = await User.findOne({ googleId: profile.id });

                if (user) {
                    // user found, go next
                    return done(null, user);
                } else {
                    // new user
                    user = await User.create(newUser);
                    console.log("new user registerd:", user.email);
                    return done(null, user);
                }
            } catch (err) {
                console.error("Passport strategy error:", err);
                return done(err, null);
            }
        }));
};