import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["team_leader", "member"],
      required: true,
    },
    permissions: {
      canCreateTenders: { type: Boolean, default: false },
      canEditTenders: { type: Boolean, default: false },
      canDeleteTenders: { type: Boolean, default: false },
      canViewApplications: { type: Boolean, default: false },
      canAcceptReject: { type: Boolean, default: false },
      canManageVerificationRequests: { type: Boolean, default: false },
      canManageTeam: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index to ensure a user can only be in an organization once
teamMemberSchema.index({ organization: 1, user: 1 }, { unique: true });

export default mongoose.model("TeamMember", teamMemberSchema);
