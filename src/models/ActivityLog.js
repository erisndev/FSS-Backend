import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Authentication
        "login",
        "logout",
        // Tender Management
        "create_tender",
        "update_tender",
        "edit_tender",
        "delete_tender",
        "publish_tender",
        "close_tender",
        "archive_tender",
        // Application Management
        "view_application",
        "accept_application",
        "reject_application",
        "update_application",
        "comment_application",
        // Verification Request Management
        "request_verification_code",
        "approve_verification_request",
        "reject_verification_request",
        // Team Management
        "add_member",
        "remove_member",
        "update_permissions",
        "update_member_status",
        // Organization
        "update_organization",
      ],
    },
    targetType: {
      type: String,
      enum: ["tender", "application", "verification_request", "team_member", "organization", "auth"],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Compound indexes for common queries
activityLogSchema.index({ organization: 1, timestamp: -1 });
activityLogSchema.index({ user: 1, timestamp: -1 });
activityLogSchema.index({ organization: 1, action: 1, timestamp: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
