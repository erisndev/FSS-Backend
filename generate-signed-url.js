import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables
dotenv.config();

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Generate signed URL function
const getSignedFileUrl = (public_id, resource_type = "raw") => {
  return cloudinary.url(public_id, {
    resource_type,
    sign_url: true,
    type: "authenticated",
  });
};

// Replace with the actual public_id you need
const publicId = 'tenders_app/kdcgxfpizoe7balbypfw';

try {
  const signedUrl = getSignedFileUrl(publicId, 'raw');
  console.log('New signed URL:', signedUrl);
} catch (error) {
  console.error('Error generating signed URL:', error);
}