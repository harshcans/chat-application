
const mongoose = require("mongoose");
const Conversation = require("../models/conversionSchema");
const User = require("../models/userSchema");

const createConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    const userId = req.userId;

    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: "Participant ID is required"
      });
    }

    if (!mongoose.isValidObjectId(participantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid participant ID"
      });
    }

    if (participantId === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot start a conversation with yourself"
      });
    }

    const participant = await User.findById(participantId);

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found"
      });
    }

    const existingConversation = await Conversation.findOne({
      participants: { $all: [userId, participantId] }
    });

    if (existingConversation) {
      return res.status(200).json({
        success: true,
        message: "Conversation already exists",
        conversation: existingConversation
      });
    }

    const conversation = await Conversation.create({
      participants: [userId, participantId]
    });

    return res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      conversation
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create conversation"
    });
  }
};

const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId
    })
      .populate("participants", "name email")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversations"
    });
  }
};

module.exports = {
  createConversation,
  getConversations
};