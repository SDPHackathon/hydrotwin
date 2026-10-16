import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rxmiubicnchjqqzjmcmy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EB9G2uRKTIbBI7HBUoSUpw_Oz8z4p8b";

// Browser / Public client (anon)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Server / Service-role client (used by API routes when SUPABASE_SERVICE_ROLE_KEY is set)
let serverClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (serverClient) return serverClient;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
  serverClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  return serverClient;
}
