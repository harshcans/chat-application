
const mongoose = require("mongoose");
const Message = require("../models/messageSchema");
const Conversation = require("../models/conversionSchema");

const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const text = typeof req.body.text === "string"
      ? req.body.text.trim()
      : "";

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "Message text is required"
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 5000 characters"
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.userId,
      text
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      updatedAt: new Date()
    });

    await message.populate("sender", "name email");

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send message"
    });
  }
};

const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID"
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    const messages = await Message.find({
      conversation: conversationId
    })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages"
    });
  }
};

module.exports = {
  sendMessage,
  getMessages
};