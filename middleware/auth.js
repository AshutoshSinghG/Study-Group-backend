const jwt = require('jsonwebtoken');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach user info to request object
            req.user = {
                email: decoded.email,
                userId: decoded.userId || decoded.id
            };

            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: "Not authorized, token failed",
                data: null,
                error: { code: "AUTH_FAILED", details: error.message }
            });
        }
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "No token, authorization denied",
            data: null,
            error: { code: "NO_TOKEN", details: "Bearer token is missing in headers" }
        });
    }
};

module.exports = { protect };