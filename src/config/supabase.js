/**
 * Supabase Configuration
 * Centralized Supabase client initialization with error handling
 */

import { createClient } from "@supabase/supabase-js";

// Validate Supabase credentials
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_KEY) are not configured');
}

// Initialize Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Test Supabase connection
 * @returns {Promise<boolean>} True if connection successful
 */
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    console.log('✓ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('✗ Supabase connection failed:', error.message);
    return false;
  }
};

/**
 * Delete file from Supabase storage
 * @param {string} fileUrl - Public URL of the file to delete
 * @returns {Promise<boolean>} True if deletion successful
 */
export const deleteFileFromSupabase = async (fileUrl) => {
  try {
    const filePath = fileUrl.split("/uploads/")[1];
    if (!filePath) {
      console.warn('[deleteFileFromSupabase] Invalid file URL:', fileUrl);
      return false;
    }

    const { error } = await supabase.storage
      .from("tenderDocs")
      .remove([`uploads/${filePath}`]);

    if (error) {
      console.error('[deleteFileFromSupabase] Error:', error.message);
      return false;
    }

    console.log('[deleteFileFromSupabase] File deleted successfully:', filePath);
    return true;
  } catch (err) {
    console.error('[deleteFileFromSupabase] Exception:', err.message);
    return false;
  }
};

export default supabase;
