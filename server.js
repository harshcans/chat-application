
require("dotenv").config();

const express = require("express");
const http = require("http");
const connectDB = require("./config/db");
const initializeSocket = require("./socket");

const app = express();
const server = http.createServer(app);

const io = initializeSocket(server);

app.use(express.json());
app.use(express.static("public"));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/conversations", require("./routes/conversationRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };