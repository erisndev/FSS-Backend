import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    phone: { type: String },
    role: {
      type: String,
      enum: ["admin", "issuer", "bidder"],
      default: "bidder",
    },
    company: { type: String },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailOTP: String,
    emailOTPExpires: Date,
    resetPasswordOTP: String,
    resetPasswordOTPExpires: Date,
  },
  { timestamps: true }
);

// Hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate reset token
userSchema.methods.createPasswordResetToken = function () {
  const token = crypto.randomBytes(20).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  return token;
};

// Generate email verification token
userSchema.methods.createEmailVerificationToken = function () {
  const token = crypto.randomBytes(20).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  return token;
};

export default mongoose.model("User", userSchema);
