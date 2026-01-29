const corsConfig = {
    origin: "http://localhost:4200",
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

const loggingFormat = ":method :url :status :res[content-length] - :response-time ms :remote-addr :user-agent";

module.exports = {
    corsConfig,
    loggingFormat
}