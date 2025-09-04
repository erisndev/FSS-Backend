// createAdmin.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js"; // adjust path if needed

dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const email = "admin@fss.com"; // your admin email
    const password = "Admin@fss"; // your admin password
    const role = "admin";

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log("⚠️ Admin already exists:", existingAdmin.email);
      process.exit(0);
    }

    // Create admin without manually hashing password
    // pre('save') in the schema will handle hashing
    const adminUser = new User({
      name: "Super Admin",
      email,
      password,
      role,
    });

    await adminUser.save();
    console.log("✅ Admin user created successfully:", adminUser.email);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating admin:", err.message);
    process.exit(1);
  }
};

createAdmin();
