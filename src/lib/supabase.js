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
