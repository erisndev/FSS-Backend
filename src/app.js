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
import fileRoutes from "./routes/files.routes.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();
connectDB();

// Security & utils
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(xss());
app.use(mongoSanitize());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use(limiter);

// Static for uploaded files (optional; restrict in prod behind auth/proxy)
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tenders", tenderRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/issuer", issuerRoutes);

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

// Errors
app.use(notFound);
app.use(errorHandler);

export default app;
