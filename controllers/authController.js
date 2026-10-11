
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/userSchema");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const normalizeEmail = (email) => email.trim().toLowerCase();

const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

const sendOtpEmail = async (email, otp) => {
    const otpMinutes = Number(process.env.OTP_EXPIRES_MINUTES || 5);

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Chat Application - Email Verification",
        text: `Your verification OTP is ${otp}. It expires in ${otpMinutes} minutes.`
    });
};

const setAccessCookie = (res, accessToken) => {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000
    });
};

const clearAccessCookie = (res) => {
    res.clearCookie("accessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    });
};

const createAccessToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_ACCESS_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m"
        }
    );
};

const createRefreshToken = (userId) => {
    const refreshDays = Number(process.env.REFRESH_TOKEN_DAYS || 7);

    return jwt.sign(
        { userId },
        process.env.JWT_REFRESH_SECRET,
        {
            expiresIn: `${refreshDays}d`
        }
    );
};

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        const normalizedEmail = normalizeEmail(email);

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOtp();
        const hashedOtp = await bcrypt.hash(otp, 10);

        const otpMinutes = Number(
            process.env.OTP_EXPIRES_MINUTES || 5
        );

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            isVerified: false,
            otp: hashedOtp,
            otpExpiresAt: new Date(
                Date.now() + otpMinutes * 60 * 1000
            )
        });

        try {
            await sendOtpEmail(user.email, otp);
        } catch (emailError) {
            await user.deleteOne();

            console.error("OTP email failed:", emailError.message);

            return res.status(502).json({
                success: false,
                message: "Could not send verification email. Please try again."
            });
        }

        return res.status(201).json({
            success: true,
            message: "Registration successful. Please verify your email.",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors)
                .map((item) => item.message)
                .join(", ");

            return res.status(400).json({
                success: false,
                message: messages
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already exists"
            });
        }

        console.error(error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (
            typeof email !== "string" ||
            typeof otp !== "string" ||
            !email.trim() ||
            !otp.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "OTP must contain six digits"
            });
        }

        const user = await User.findOne({
            email: normalizeEmail(email)
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Email is already verified"
            });
        }

        if (
            !user.otp ||
            !user.otpExpiresAt ||
            user.otpExpiresAt.getTime() <= Date.now()
        ) {
            return res.status(400).json({
                success: false,
                message: "OTP is invalid or expired. Request a new OTP."
            });
        }

        const isOtpCorrect = await bcrypt.compare(otp, user.otp);

        if (!isOtpCorrect) {
            return res.status(400).json({
                success: false,
                message: "Incorrect OTP"
            });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpiresAt = null;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Email verified successfully. You can now log in."
        });
    } catch (error) {
        console.error(error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const user = await User.findOne({
            email: normalizeEmail(email)
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Email is already verified"
            });
        }

        const otp = generateOtp();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const otpMinutes = Number(
            process.env.OTP_EXPIRES_MINUTES || 5
        );

        user.otp = hashedOtp;
        user.otpExpiresAt = new Date(
            Date.now() + otpMinutes * 60 * 1000
        );

        await user.save();

        try {
            await sendOtpEmail(user.email, otp);
        } catch (emailError) {
            user.otp = null;
            user.otpExpiresAt = null;
            await user.save();

            console.error("OTP email failed:", emailError.message);

            return res.status(502).json({
                success: false,
                message: "Could not send OTP email. Please try again."
            });
        }

        return res.status(200).json({
            success: true,
            message: "A new OTP has been sent to your email."
        });
    } catch (error) {
        console.error(error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: normalizeEmail(email)
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email before logging in"
            });
        }

        const accessToken = createAccessToken(user._id.toString());
        const refreshToken = createRefreshToken(user._id.toString());

        user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        await user.save();

        setAccessCookie(res, accessToken);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        console.error(error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (
            typeof refreshToken !== "string" ||
            !refreshToken
        ) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        const decoded = jwt.verify(
            refreshToken,
            process.env.JWT_REFRESH_SECRET
        );

        const user = await User.findById(decoded.userId)
            .select("+refreshTokenHash");

        if (!user || !user.refreshTokenHash) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        const isTokenCorrect = await bcrypt.compare(
            refreshToken,
            user.refreshTokenHash
        );

        if (!isTokenCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        const accessToken = createAccessToken(user._id.toString());
        const newRefreshToken = createRefreshToken(user._id.toString());

        user.refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
        await user.save();

        setAccessCookie(res, accessToken);

        return res.status(200).json({
            success: true,
            message: "Tokens refreshed successfully",
            refreshToken: newRefreshToken
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Refresh token is invalid or expired"
        });
    }
};

const logoutUser = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (typeof refreshToken === "string" && refreshToken) {
            try {
                const decoded = jwt.verify(
                    refreshToken,
                    process.env.JWT_REFRESH_SECRET
                );

                const user = await User.findById(decoded.userId)
                    .select("+refreshTokenHash");

                if (user && user.refreshTokenHash) {
                    const isTokenCorrect = await bcrypt.compare(
                        refreshToken,
                        user.refreshTokenHash
                    );

                    if (isTokenCorrect) {
                        user.refreshTokenHash = null;
                        await user.save();
                    }
                }
            } catch (error) {
                // Invalid or expired refresh tokens cannot be reused.
            }
        }

        clearAccessCookie(res);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error(error.message);

        clearAccessCookie(res);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error(error.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

module.exports = {
    registerUser,
    verifyOtp,
    resendOtp,
    loginUser,
    refreshAccessToken,
    logoutUser,
    getMe
};