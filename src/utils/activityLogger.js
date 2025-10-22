import ActivityLog from "../models/ActivityLog.js";

// Log activity for an organization
export const logActivity = async ({
  organizationId,
  userId,
  action,
  targetType = null,
  targetId = null,
  details = {},
  req = null,
}) => {
  try {
    const activityData = {
      organization: organizationId,
      user: userId,
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date(),
    };

    // Extract IP and user agent from request if provided
    if (req) {
      activityData.ipAddress =
        req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
      activityData.userAgent = req.headers["user-agent"];
    }

    await ActivityLog.create(activityData);
  } catch (error) {
    console.error("Error logging activity:", error);
    // Don't throw error - logging should not break the main flow
  }
};

// Middleware to automatically log activities
export const activityLoggerMiddleware = (action, targetType, getTargetId = null) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to log after successful response
    res.json = function (data) {
      // Only log if response is successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Log activity asynchronously
        if (req.user && req.user.organizationId) {
          const targetId = getTargetId ? getTargetId(req, data) : null;
          
          logActivity({
            organizationId: req.user.organizationId,
            userId: req.user._id,
            action,
            targetType,
            targetId,
            details: {
              method: req.method,
              path: req.path,
              body: req.body,
            },
            req,
          }).catch(err => console.error("Activity logging failed:", err));
        }
      }

      // Call original json method
      return originalJson(data);
    };

    next();
  };
};

export default { logActivity, activityLoggerMiddleware };
