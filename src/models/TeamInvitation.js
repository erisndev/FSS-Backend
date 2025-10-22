import mongoose from "mongoose";
import crypto from "crypto";

const teamInvitationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    permissions: {
      canCreateTenders: { type: Boolean, default: false },
      canEditTenders: { type: Boolean, default: false },
      canDeleteTenders: { type: Boolean, default: false },
      canViewApplications: { type: Boolean, default: false },
      canAcceptReject: { type: Boolean, default: false },
      canManageTeam: { type: Boolean, default: false },
    },
    invitationToken: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },
  { timestamps: true }
);

// Generate invitation token
teamInvitationSchema.methods.generateInvitationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.invitationToken = crypto.createHash("sha256").update(token).digest("hex");
  return token;
};

// Check if invitation is expired
teamInvitationSchema.methods.isExpired = function () {
  return this.expiresAt < Date.now() || this.status === "expired";
};

export default mongoose.model("TeamInvitation", teamInvitationSchema);
