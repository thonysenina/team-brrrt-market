import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function logAudit(eventId, merchantId, action, details = {}) {
  await supabase.from('fm_audit_log').insert({
    event_id: eventId,
    merchant_id: merchantId,
    action,
    details,
  });
}

/**
 * Returns true if the file is a HEIC/HEIF image.
 * Checks both the MIME type and the file extension since
 * iOS often provides an empty or generic MIME type for HEIC files.
 */
function isHeic(file) {
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop().toLowerCase();
  return mime === 'image/heic' || mime === 'image/heif' || ext === 'heic' || ext === 'heif';
}

/**
 * Converts a HEIC/HEIF file to a JPEG Blob using heic2any.
 * Falls back to the original file if conversion fails.
 */
async function convertHeicToJpeg(file) {
  try {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    // heic2any can return an array of blobs for multi-page HEIC — take the first
    const resultBlob = Array.isArray(blob) ? blob[0] : blob;
    // Reconstruct as a File so it has a usable name
    const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
    return new File([resultBlob], newName, { type: 'image/jpeg' });
  } catch (err) {
    console.error('HEIC conversion failed:', err);
    return file; // fall back to original — upload will succeed but thumbnail may not render
  }
}

/**
 * Upload a photo file to Supabase Storage.
 * HEIC/HEIF files are automatically converted to JPEG first.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadItemPhoto(file, merchantId) {
  let uploadFile = file;

  if (isHeic(file)) {
    uploadFile = await convertHeicToJpeg(file);
  }

  const ext = uploadFile.name.split('.').pop();
  const path = `${merchantId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('item-photos')
    .upload(path, uploadFile, { upsert: true, contentType: uploadFile.type });

  if (error) {
    console.error('Photo upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete a photo from Supabase Storage given its public URL.
 */
export async function deleteItemPhoto(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const parts = url.pathname.split('/item-photos/');
    if (parts.length < 2) return;
    await supabase.storage.from('item-photos').remove([parts[1]]);
  } catch (e) {
    console.error('Photo delete error:', e);
  }
}

/**
 * Prepares an image file for preview and upload.
 * If the file is HEIC/HEIF, converts it to JPEG first so the
 * browser can render the thumbnail immediately.
 * Returns { file, previewUrl } — always revoke previewUrl when done.
 */
export async function prepareImageFile(rawFile) {
  let file = rawFile;
  if (isHeic(rawFile)) {
    file = await convertHeicToJpeg(rawFile);
  }
  const previewUrl = URL.createObjectURL(file);
  return { file, previewUrl };
}
