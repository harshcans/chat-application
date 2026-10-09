
const Conversation = require("./conversationSchema");
const User = require("../models/userSchema");

const createConversation = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                message: "User ID is required"
            });
        }

        if (userId === req.userId.toString()) {
            return res.status(400).json({
                message: "You cannot start a conversation with yourself"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const existingConversation = await Conversation.findOne({
            participants: {
                $all: [req.userId, userId]
            }
        });

        if (existingConversation) {
            return res.status(200).json({
                message: "Conversation already exists",
                conversation: existingConversation
            });
        }

        const conversation = await Conversation.create({
            participants: [req.userId, userId]
        });

        res.status(201).json({
            message: "Conversation created successfully",
            conversation
        });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid user ID"
            });
        }

        console.log(error);

        res.status(500).json({
            message: "Internal server error"
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

        res.status(200).json({
            count: conversations.length,
            conversations
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = {
    createConversation,
    getConversations
};