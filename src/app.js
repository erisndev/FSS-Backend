/**
 * Express Application Configuration
 * Main application setup with middleware, routes, and error handling
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import mongoose from "mongoose";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import tenderRoutes from "./routes/tenders.routes.js";
import applicationRoutes from "./routes/applications.routes.js";
import notificationRoutes from "./routes/notifications.routes.js";
import issuerRoutes from "./routes/issuer.routes.js";
import verificationCodeRoutes from "./routes/verificationCode.routes.js";
import teamAuthRoutes from "./routes/teamAuth.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import teamMemberRoutes from "./routes/teamMember.routes.js";
import activityLogRoutes from "./routes/activityLog.routes.js";

// Import error handlers
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();

// Connect to database
connectDB();

// ---------------- Security Middleware ----------------
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(xss());
app.use(mongoSanitize());

// ---------------- Request Processing Middleware ----------------
app.use(requestIdMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logging
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ---------------- Rate Limiters ----------------
// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: true,
});

// OTP rate limiter
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 OTP requests per hour
  message: "Too many OTP requests, please try again later",
});

// Apply general rate limiter to all routes
app.use(generalLimiter);

// ---------------- API Routes ----------------
// Apply specific rate limiters to auth routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/verify-otp", otpLimiter);
app.use("/api/auth/verify-register-otp", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);
app.use("/api/auth/resend-register-otp", otpLimiter);
app.use("/api/auth/request-password-reset", otpLimiter);

// Team auth endpoints are also part of the authentication surface
// and should be protected from brute force / enumeration.
app.use("/api/team-auth/team-login", authLimiter);
// Allow more headroom for member lookup (UI might retry, user might type, etc.)
app.use(
  "/api/team-auth/team-members",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many team member lookup requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/team-auth", teamAuthRoutes);
app.use("/api/tenders", tenderRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/issuer", issuerRoutes);
app.use("/api/verification-code", verificationCodeRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/team-members", teamMemberRoutes);
app.use("/api/activity-logs", activityLogRoutes);

// ---------------- Health Check ----------------
app.get("/health", async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: "ok",
    services: {},
  };

  // Check MongoDB connection
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      health.services.mongodb = "connected";
    } else {
      health.services.mongodb = "disconnected";
      health.status = "degraded";
    }
  } catch (error) {
    health.services.mongodb = "error";
    health.status = "degraded";
  }

  // Check Supabase (basic check)
  try {
    health.services.supabase = "configured";
  } catch (error) {
    health.services.supabase = "error";
    health.status = "degraded";
  }

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get("/", (req, res) => {
  res.send("Welcome to the FSS API");
});

// ---------------- Error Handlers ----------------
app.use(notFound);
app.use(errorHandler);

export default app;
