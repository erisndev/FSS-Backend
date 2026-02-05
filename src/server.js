import dotenv from "dotenv";
dotenv.config();

// Validate environment variables before starting
import { validateEnv } from "./config/validateEnv.js";
validateEnv();

import app from "./app.js";
import mongoose from "mongoose";
import { testSupabaseConnection } from "./config/supabase.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log("=====================================");
  console.log("🚀 Server started successfully");
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📡 Listening on port: ${PORT}`);
  console.log("=====================================");

  try {
    await testSupabaseConnection();
    console.log("✅ Supabase connection OK");
  } catch (error) {
    console.error("❌ Supabase connection failed:", error.message);
  }
});
