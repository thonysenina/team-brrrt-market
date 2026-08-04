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

// Longest-side cap applied to every uploaded photo. Thumbnails across
// the app render at 32-36px, and even the storefront/lightbox full view
// doesn't need more than this — keeping originals uncapped was the main
// driver of Supabase Cached Egress usage (full-res phone photos re-served
// on every page view across POS, Dashboard, AdminPanel, and Storefront).
const MAX_DIMENSION = 1200; // px

/**
 * Converts a HEIC/HEIF file to JPEG using heic2any (lazy-loaded).
 * For other unrecognised types, draws through a canvas to force a
 * decodable JPEG — this also works for library photos on iOS that
 * arrive with a blank MIME type but are actually valid images.
 * Both paths are downsized to MAX_DIMENSION before returning.
 */
async function toJpeg(file) {
  // Try heic2any for HEIC/HEIF first
  if (isHeic(file)) {
    try {
      const heic2any = (await import('heic2any')).default;
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const resultBlob = Array.isArray(blob) ? blob[0] : blob;
      const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      // Route through the same resize step below rather than returning
      // the full-resolution HEIC-derived JPEG directly.
      return await resizeToJpeg(new File([resultBlob], newName, { type: 'image/jpeg' }));
    } catch (err) {
      console.warn('heic2any failed, falling back to canvas:', err);
    }
  }

  // Canvas fallback — works for any image the OS can decode,
  // including library photos with missing MIME types on iOS.
  return resizeToJpeg(file);
}

/**
 * Draws a file through a canvas, downsizing to MAX_DIMENSION on the
 * longest side and re-encoding as JPEG. Used for both the HEIC path
 * and the general fallback path so every upload is capped consistently.
 */
function resizeToJpeg(file) {
  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: width, naturalHeight: height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        const newName = file.name.replace(/\.[^.]+$/, '.jpg');
        resolve(new File([blob], newName, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.8);
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
  // Log what iOS actually gives us — helps diagnose library vs camera differences
  console.log('[photo] name:', rawFile.name, '| type:', rawFile.type || '(empty)', '| size:', rawFile.size, 'bytes');

  let file = rawFile;

  // Step 1: always run through canvas to normalise the file.
  // iOS photo library picks often have blank MIME types and can't be
  // rendered directly. Drawing through canvas forces a full decode and
  // re-encode to a clean JPEG the browser can display.
  try {
    file = await toJpeg(rawFile);
    console.log('[photo] after toJpeg — name:', file.name, '| type:', file.type, '| size:', file.size);
  } catch (err) {
    console.error('[photo] toJpeg threw:', err);
    file = rawFile; // fall back to original
  }

  // Step 2: read into a data URL for the preview.
  // Object URLs can silently fail on iOS Safari; data URLs are always safe.
  try {
    const previewUrl = await toDataUrl(file);
    console.log('[photo] previewUrl prefix:', previewUrl.slice(0, 40));
    return { file, previewUrl };
  } catch (err) {
    console.error('[photo] toDataUrl threw:', err);
    // Last resort — try object URL so at least upload can proceed
    return { file, previewUrl: URL.createObjectURL(file) };
  }
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
    .upload(path, uploadFile, {
      upsert: true,
      contentType: uploadFile.type || 'image/jpeg',
      // Path already includes Date.now(), so it's never reused — safe to
      // cache for a year instead of the 1-hour default, cutting repeat
      // Cached Egress hits across POS/Dashboard/AdminPanel/Storefront.
      cacheControl: '31536000',
    });

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
