const mongoose = require("mongoose");

const connectionURL = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.sgdzstx.mongodb.net/${process.env.MONGO_DATABASE}?appName=Cluster0`

// Connect to MongoDB using Mongoose
async function connectDB(uri) {
  // If a URI is provided (e.g., test in-memory DB), use it even if NODE_ENV === 'test'.
  const url = uri || connectionURL;

  if (process.env.NODE_ENV === "test" && !uri) {
    // Prevent accidental connection to production DB during tests when no test URI supplied
    console.log("Skipping DB connect in test environment (no test URI provided)");
    return;
  }

  try {
    await mongoose.connect(url);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.log("Error connecting to MongoDB:", error);
    throw error;
  }
}

// Close the Mongoose connection
async function closeConnection() {
  await mongoose.disconnect();
}

// watch for connection errors after initial connection
function connectionEventListeners() {
  if (process.env.NODE_ENV === 'test') return; // avoid adding listeners in tests
  mongoose.connection.on("error", (err) => {
    console.error(`🚨 MongoDB connection error: ${err}`);
  });
}

function getDbStatus() {
  if (process.env.NODE_ENV === 'test') return 0; // disconnected
  return mongoose.connection.readyState;
}

module.exports = {
  connectDB,
  closeConnection,
  getDbStatus,
  connectionEventListeners,
};
