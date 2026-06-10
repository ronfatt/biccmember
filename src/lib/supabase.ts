import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

const fallbackSupabaseUrl = "https://fwoaamvsclfrkattqvai.supabase.co";
const fallbackSupabaseAnonKey = "sb_publishable_oSaaK_cFa5fDFt-DbD33eg_0y2wOHvf";

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey;

  if (!url || !anonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(url, anonKey);
  }

  return browserClient;
}
