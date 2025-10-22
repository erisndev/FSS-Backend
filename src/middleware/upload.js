import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configure Multer with memory storage
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// Upload file to Supabase Storage
export const uploadToSupabase = async (file, tenderName = "general") => {
  console.log(
    "[uploadToSupabase] Starting upload for file:",
    file.originalname,
    "under tender:",
    tenderName
  );
  const fileExt = path.extname(file.originalname);
  const fileName = `${Date.now()}-${file.originalname}`;

  const { data, error } = await supabase.storage
    .from("tenderDocs")
    .upload(`uploads/${tenderName}/${fileName}`, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error("[uploadToSupabase] Upload error:", error.message);
    throw new Error(error.message);
  }

  const { data: publicUrl } = supabase.storage
    .from("tenderDocs")
    .getPublicUrl(data.path);

  console.log(
    "[uploadToSupabase] Upload successful. Public URL:",
    publicUrl.publicUrl
  );
  return publicUrl.publicUrl;
};

// Authentication middleware (duplicate of auth.js)
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Protect routes by verifying JWT token
export const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) return res.status(401).json({ message: "Not authorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive)
      return res.status(401).json({ message: "User not active" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
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
