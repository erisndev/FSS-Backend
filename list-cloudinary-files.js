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

async function listFiles() {
  try {
    // List all raw files in tenders_app folder
    const result = await cloudinary.api.resources({
      type: 'upload',
      resource_type: 'raw',
      prefix: 'tenders_app/',
      max_results: 50
    });
    
    console.log(`Found ${result.resources.length} files in tenders_app folder:`);
    result.resources.forEach((resource, index) => {
      console.log(`${index + 1}. Public ID: ${resource.public_id}`);
      console.log(`   URL: ${resource.secure_url}`);
      console.log(`   Created: ${resource.created_at}`);
      console.log(`   Size: ${resource.bytes} bytes`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error listing files:', error);
  }
}

listFiles();