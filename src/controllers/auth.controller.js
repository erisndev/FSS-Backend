// controllers/auth.controller.js
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import {
  sendRegisterOTPEmail,
  sendResetPasswordOTPEmail,
} from "../utils/emails.js";
import Notification from "../models/Notification.js";

// ---------------- JWT GENERATOR ----------------
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// ---------------- REGISTER ----------------
export const register = async (req, res) => {
  try {
    const { name, email, password, role, company, description } = req.body;
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already exists" });

    const user = await User.create({
      name,
      email,
      password,
      role,
      company,
      description,
    });

    // Generate OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    await Notification.create({
      user: user._id,
      type: "system",
      title: "Welcome to the platform",
      body: `User ${user.name} registered successfully.`,
    });
    // ✅ Pass full user object here
    await sendRegisterOTPEmail(user, otp);

    res.status(201).json({ message: "User created, OTP sent to email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- VERIFY REGISTER OTP ----------------
export const verifyRegisterOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      !user.emailOTP ||
      String(user.emailOTP).trim() !== String(otp).trim() ||
      user.emailOTPExpires < Date.now()
    )
      return res
        .status(400)
        .json({ message: "Invalid or expired registration OTP" });

    user.emailVerified = true;
    user.emailOTP = undefined;
    user.emailOTPExpires = undefined;

    const token = generateToken(user._id);
    await user.save();

    res.json({
      message: "Email verified successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        description: user.description,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- VERIFY RESET PASSWORD OTP ----------------
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      !user.resetPasswordOTP ||
      String(user.resetPasswordOTP).trim() !== String(otp).trim() ||
      user.resetPasswordOTPExpires < Date.now()
    )
      return res
        .status(400)
        .json({ message: "Invalid or expired password reset OTP" });

    await user.save();
    // ✅ Send notification

    res.json({
      message: "Password reset OTP verified. You can now set a new password.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- LOGIN ----------------
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: "Invalid credentials" });

    if (!user.emailVerified)
      return res.status(403).json({ message: "Email not verified" });

    user.lastLogin = new Date();
    await user.save();

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        description: user.description,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- GET CURRENT USER ----------------
export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      description: user.description,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- UPDATE CURRENT USER ----------------
export const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, company, description, password } = req.body;
    if (name) user.name = name;
    if (company) user.company = company;
    if (description) user.description = description;
    if (password) user.password = password;

    await user.save();
    await Notification.create({
      user: user._id,
      type: "system",
      title: "Profile Updated",
      body: `Your profile was updated successfully.`,
    });

    // Return the updated user
    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        description: user.description,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- ADMIN: GET ALL USERS ----------------
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "-password -emailOTP -resetPasswordOTP"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- ADMIN: GET USER BY ID ----------------
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -emailOTP -resetPasswordOTP"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- ADMIN: UPDATE USER BY ID ----------------
export const updateUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, company, description, role, isActive } = req.body;
    if (name) user.name = name;
    if (company) user.company = company;
    if (description) user.description = description;
    if (role) user.role = role;
    if (typeof isActive === "boolean") user.isActive = isActive;

    await user.save();
    await Notification.create({
      user: user._id,
      type: "system",
      title: "Admin Update",
      body: `Your account was updated by an admin.`,
    });
    res.json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- ADMIN: DELETE USER ----------------
export const deleteUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.deleteOne();
    await Notification.create({
      user: user._id,
      type: "system",
      title: "Account Deleted",
      body: `Your account was deleted by an admin.`,
    });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- REQUEST PASSWORD RESET ----------------
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save({ validateBeforeSave: false });

    // ✅ Pass full user object
    await sendResetPasswordOTPEmail(user, otp);

    res.json({ message: "Password reset OTP sent" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- RESET PASSWORD ----------------
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (
      !user.resetPasswordOTP ||
      user.resetPasswordOTP !== otp ||
      user.resetPasswordOTPExpires < Date.now()
    )
      return res.status(400).json({ message: "Invalid or expired OTP" });

    user.password = password;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- RESEND REGISTRATION OTP ----------------
export const resendRegisterOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.emailVerified)
      return res.status(400).json({ message: "Email already verified" });

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailOTP = otp;
    user.emailOTPExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save({ validateBeforeSave: false });

    await sendRegisterOTPEmail(user, otp);

    res.json({ message: "New OTP sent to your email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------- RESEND PASSWORD RESET OTP ----------------
export const resendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save({ validateBeforeSave: false });

    await sendResetPasswordOTPEmail(user, otp);

    res.json({ message: "New OTP sent to your email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
