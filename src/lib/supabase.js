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
 * Upload a photo file to Supabase Storage.
 * Returns the public URL on success, or null on failure.
 */
export async function uploadItemPhoto(file, merchantId) {
  const ext = file.name.split('.').pop();
  const path = `${merchantId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('item-photos')
    .upload(path, file, { upsert: true });
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
    // path is everything after /object/public/item-photos/
    const parts = url.pathname.split('/item-photos/');
    if (parts.length < 2) return;
    await supabase.storage.from('item-photos').remove([parts[1]]);
  } catch (e) {
    console.error('Photo delete error:', e);
  }
}
