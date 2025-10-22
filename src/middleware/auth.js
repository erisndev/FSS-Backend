import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Protect routes by verifying JWT token
export const protect = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        message: "No token provided",
        code: "NO_TOKEN"
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify token - this automatically checks expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and check if active
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        message: "User not active",
        code: "USER_INACTIVE"
      });
    }

    // Attach user info to request
    req.user = user;
    req.userId = decoded.id;
    
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        message: "Token has expired. Please login again.",
        code: "TOKEN_EXPIRED",
        expired: true
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        message: "Invalid token",
        code: "INVALID_TOKEN"
      });
    }
    
    return res.status(401).json({ 
      message: "Authentication failed",
      code: "AUTH_FAILED"
    });
  }
};

// Authorize user based on role
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "Forbidden" });
    next();
  };
