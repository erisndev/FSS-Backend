import multer from "multer";
import path from "path";
import { supabase } from "../config/supabase.js";

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/jpg'
];

// File size limit (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// File filter function
const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Word, Excel, and images are allowed.'), false);
  }
};

// Configure Multer with memory storage and validation
const storage = multer.memoryStorage();

export const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10 // Maximum 10 files per request
  }
});

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

// Re-export authentication middleware from auth.js to avoid duplication
export { protect, authorize } from "./auth.js";
