import ActivityLog from "../models/ActivityLog.js";
import TeamMember from "../models/TeamMember.js";

// Get all activities for an organization
export const getOrganizationActivities = async (req, res) => {
  try {
    const organizationId = req.params.organizationId || req.user.organizationId;
    const { 
      limit = 50, 
      page = 1, 
      action, 
      userId, 
      targetType,
      startDate, 
      endDate 
    } = req.query;

    // Build query
    const query = { organization: organizationId };

    if (action) {
      query.action = action;
    }

    if (userId) {
      query.user = userId;
    }

    if (targetType) {
      query.targetType = targetType;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate("user", "name email")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get organization activities error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get activities for a specific team member
export const getMemberActivities = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { limit = 50, page = 1, action, startDate, endDate } = req.query;

    const teamMember = await TeamMember.findById(memberId);

    if (!teamMember) {
      return res.status(404).json({ message: "Team member not found" });
    }

    // Build query
    const query = {
      organization: teamMember.organization,
      user: teamMember.user,
    };

    if (action) {
      query.action = action;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate("user", "name email")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get member activities error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get activities for a specific resource
export const getResourceActivities = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const query = { targetId: resourceId };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      ActivityLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .populate("user", "name email")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get resource activities error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get activity statistics for an organization
export const getActivityStats = async (req, res) => {
  try {
    const organizationId = req.params.organizationId || req.user.organizationId;
    const { startDate, endDate } = req.query;

    const query = { organization: organizationId };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Get activity counts by action type
    const actionStats = await ActivityLog.aggregate([
      { $match: query },
      { $group: { _id: "$action", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get most active members
    const memberStats = await ActivityLog.aggregate([
      { $match: query },
      { $group: { _id: "$user", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: "$user.name",
          email: "$user.email",
          activityCount: "$count",
        },
      },
    ]);

    // Get activity timeline (daily counts)
    const timelineStats = await ActivityLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }, // Last 30 days
    ]);

    res.json({
      actionStats,
      memberStats,
      timelineStats,
    });
  } catch (error) {
    console.error("Get activity stats error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Export activities to CSV file
export const exportActivities = async (req, res) => {
  try {
    const organizationId = req.params.organizationId || req.user.organizationId;
    const { action, userId, startDate, endDate } = req.query;

    // Build query
    const query = { organization: organizationId };

    if (action) query.action = action;
    if (userId) query.user = userId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const activities = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .populate("user", "name email")
      .lean();

    // Convert to CSV
    const csvHeader = "Timestamp,User,Email,Action,Target Type,Target ID,IP Address\n";
    const csvRows = activities.map(activity => {
      return [
        activity.timestamp.toISOString(),
        activity.user?.name || "Unknown",
        activity.user?.email || "Unknown",
        activity.action,
        activity.targetType || "",
        activity.targetId || "",
        activity.ipAddress || "",
      ].join(",");
    }).join("\n");

    const csv = csvHeader + csvRows;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=activities-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error("Export activities error:", error);
    res.status(500).json({ message: error.message });
  }
};

export default {
  getOrganizationActivities,
  getMemberActivities,
  getResourceActivities,
  getActivityStats,
  exportActivities,
};
