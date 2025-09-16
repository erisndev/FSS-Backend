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

const publicId = 'tenders_app/kdcgxfpizoe7balbypfw';

async function checkFile() {
  try {
    // Try to get resource details
    const result = await cloudinary.api.resource(publicId, { resource_type: 'raw' });
    console.log('File exists:', result);
    console.log('Public ID:', result.public_id);
    console.log('URL:', result.secure_url);
    console.log('Created:', result.created_at);
  } catch (error) {
    if (error.http_code === 404) {
      console.log('File not found on Cloudinary. The resource may have been deleted or never existed.');
    } else {
      console.error('Error checking file:', error);
    }
  }
}

checkFile();