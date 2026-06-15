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
 * Returns true if the file is HEIC/HEIF.
 * Checks both MIME type and extension since iOS often reports
 * a blank or generic MIME type for photos from the library.
 */
function isHeic(file) {
  const mime = (file.type || '').toLowerCase();
  const ext = file.name.split('.').pop().toLowerCase();
  return mime === 'image/heic' || mime === 'image/heif' || ext === 'heic' || ext === 'heif';
}

/**
 * Returns true if the browser likely cannot render this file natively.
 * Covers HEIC and any file with a blank/unknown MIME type (common for
 * iOS photo library picks where the system hasn't assigned a type yet).
 */
function needsConversion(file) {
  if (isHeic(file)) return true;
  const mime = (file.type || '').toLowerCase();
  // Empty or non-image MIME on a file with an image extension → convert
  if (!mime.startsWith('image/')) {
    const ext = file.name.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'avif'].includes(ext);
  }
  return false;
}

/**
 * Converts a HEIC/HEIF file to JPEG using heic2any (lazy-loaded).
 * For other unrecognised types, draws through a canvas to force a
 * decodable JPEG — this also works for library photos on iOS that
 * arrive with a blank MIME type but are actually valid images.
 */
async function toJpeg(file) {
  // Try heic2any for HEIC/HEIF first
  if (isHeic(file)) {
    try {
      const heic2any = (await import('heic2any')).default;
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const resultBlob = Array.isArray(blob) ? blob[0] : blob;
      const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      return new File([resultBlob], newName, { type: 'image/jpeg' });
    } catch (err) {
      console.warn('heic2any failed, falling back to canvas:', err);
    }
  }

  // Canvas fallback — works for any image the OS can decode,
  // including library photos with missing MIME types on iOS
  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        const newName = file.name.replace(/\.[^.]+$/, '.jpg');
        resolve(new File([blob], newName, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.88);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // give up and return original
    };
    img.src = objectUrl;
  });
}

/**
 * Reads a file into a base64 data URL.
 * More reliable than createObjectURL for previews on iOS Safari,
 * where object URLs from library picks can silently fail to render.
 */
function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Prepares an image file for preview and upload.
 *
 * - Converts HEIC/HEIF and unknown-MIME files to JPEG so thumbnails
 *   render reliably on all browsers including iOS Safari.
 * - Returns a base64 data URL for the preview (never expires, unlike
 *   object URLs which can silently break on iOS).
 * - Returns the processed File for uploading.
 */
export async function prepareImageFile(rawFile) {
  let file = rawFile;

  if (needsConversion(rawFile)) {
    file = await toJpeg(rawFile);
  }

  // Use FileReader for the preview — data URLs are persistent and
  // work correctly when assigned to <img src> on all platforms.
  const previewUrl = await toDataUrl(file);
  return { file, previewUrl };
}

/**
 * Upload a photo to Supabase Storage.
 * Converts HEIC/unknown files to JPEG before uploading.
 * Returns the public URL, or null on failure.
 */
export async function uploadItemPhoto(file, merchantId) {
  let uploadFile = file;

  if (needsConversion(file)) {
    uploadFile = await toJpeg(file);
  }

  const ext = (uploadFile.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${merchantId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('item-photos')
    .upload(path, uploadFile, { upsert: true, contentType: uploadFile.type || 'image/jpeg' });

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
