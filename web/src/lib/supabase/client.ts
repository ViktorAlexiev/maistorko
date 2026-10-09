import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { browserSupabaseUrl, cookieOptions } from "./config";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  client ??= createBrowserClient<Database>(browserSupabaseUrl(), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions,
  });
  return client;
}
