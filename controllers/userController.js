const User = require("../models/userSchema");

const getUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");

        res.status(200).json({
            count: users.length,
            users
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = { getUsers };