// backend/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";

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

import { notFound, errorHandler } from "./middleware/error.js";

const app = express();
connectDB();

// ---------------- Security & Utilities ----------------
app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
    credentials: true,
  })
);
app.use(xss());
app.use(mongoSanitize());
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ---------------- Rate Limiter ----------------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
});
app.use(limiter);

// ---------------- API Routes ----------------
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
app.get("/health", (req, res) => res.json({ ok: true }));

// ---------------- Error Handlers ----------------
app.use(notFound);
app.use(errorHandler);

export default app;
