
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Conversation = require("./models/conversionSchema");
const Message = require("./models/messageSchema");

const initializeSocket = (server) => {
  const io = new Server(server);

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Access token required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET
      );

      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error("Invalid or expired access token"));
    }
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.userId);

    socket.on("joinConversation", async (conversationId, callback) => {
      try {
        if (!mongoose.isValidObjectId(conversationId)) {
          return callback?.({
            success: false,
            message: "Invalid conversation ID"
          });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId
        });

        if (!conversation) {
          return callback?.({
            success: false,
            message: "Conversation not found or access denied"
          });
        }

        socket.join(conversationId);

        callback?.({
          success: true,
          message: "Joined conversation successfully"
        });
      } catch (error) {
        callback?.({
          success: false,
          message: "Failed to join conversation"
        });
      }
    });

    socket.on("sendMessage", async (data, callback) => {
      try {
        const { conversationId } = data || {};
        const text = typeof data?.text === "string"
          ? data.text.trim()
          : "";

        if (!mongoose.isValidObjectId(conversationId)) {
          return callback?.({
            success: false,
            message: "Invalid conversation ID"
          });
        }

        if (!text || text.length > 5000) {
          return callback?.({
            success: false,
            message: "Message must contain 1 to 5000 characters"
          });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.userId
        });

        if (!conversation) {
          return callback?.({
            success: false,
            message: "Conversation not found or access denied"
          });
        }

        const message = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          text
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          updatedAt: new Date()
        });

        await message.populate("sender", "name email");

        io.to(conversationId).emit("newMessage", message);

        callback?.({
          success: true,
          message: "Message sent successfully",
          data: message
        });
      } catch (error) {
        callback?.({
          success: false,
          message: "Failed to send message"
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.userId);
    });
  });

  return io;
};

module.exports = initializeSocket;