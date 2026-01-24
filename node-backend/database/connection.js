const mongoose = require("mongoose");

const connectionURL = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/${process.env.MONGO_DATABASE}?appName=Cluster0`

// Connect to MongoDB using Mongoose
async function connectDB() {
  try {
    await mongoose.connect(connectionURL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log("Error connecting to MongoDB:", error);
  }
}

// Close the Mongoose connection
async function closeConnection() {
  await mongoose.disconnect();
}

// watch for connection errors after initial connection
function connectionEventListeners() {
  mongoose.connection.on("error", (err) => {
    console.error(`🚨 MongoDB connection error: ${err}`);
  });
}

function getDbStatus() {
  return mongoose.connection.readyState;
}

module.exports = {
  connectDB,
  closeConnection,
  getDbStatus,
  connectionEventListeners,
};
