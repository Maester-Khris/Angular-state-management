const ANGULAR_URL = process.env.NODE_ENV === 'production'
    ? process.env.ANGULAR_FRONT_URL
    : 'http://localhost:4200';

const corsConfig = {
    origin: ANGULAR_URL,
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

const loggingFormat = ":method :url :status :res[content-length] - :response-time ms :remote-addr :user-agent";

module.exports = {
    corsConfig,
    loggingFormat
}