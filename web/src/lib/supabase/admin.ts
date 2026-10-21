import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * The service-role client. It bypasses Row Level Security, so it is for the few server actions that must act on
 * behalf of the system (deleting an account together with its files). Never import it from client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Липсват NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
