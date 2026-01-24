require("dotenv").config();

const express = require("express");
const app = express();
const database = require("./database/connection");
const { signup, login } = require("./auth/authService");

const homeRouter = require("./routing/home");
const activityRouter = require("./routing/activity");
const profileRouter = require("./routing/profile");
const authRouter = require("./routing/auth");

app.use(express.json());

let server;
const PORT = process.env.PORT || 3000;

app.use("/", homeRouter);
app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/", activityRouter);


const startServer = async () => {
  try {
    database.connectionEventListeners();
    await database.connectDB();
    server = app.listen(PORT, async () => {
      console.log(`Server started on port ${PORT}`);
    });
  } catch (err) {
    console.log("Error starting server", err);
  }
};

const serverShutdown = async () => {
  console.log("Received shutdown signal. Closing server...");

  if (!server) {
    console.log("Server not started. Exiting...");
    process.exit(0);
    return;
  }

  server.close(async (err) => {
    if (err) {
      console.log("Error while shutting down server", err);
      process.exit(1);
    }
     
    await database.closeConnection();
    console.log("Server shutdown complete.");
    process.exit(0);
  });

  setTimeout(() => {
    console.log("Server shutdown timed out. Exiting...");
    process.exit(1);
  }, 10000);
};

startServer();
process.on("SIGINT", serverShutdown);
process.on("SIGTERM", serverShutdown);
