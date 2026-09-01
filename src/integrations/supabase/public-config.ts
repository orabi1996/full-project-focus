/**
 * Public browser credentials for the production Supabase project.
 *
 * These values are intentionally safe to ship to the browser: the publishable
 * (anon) key cannot bypass Row Level Security. Environment variables still take
 * precedence so staging or self-hosted deployments can point at another project.
 * Never add the service-role key to this file.
 */
export const DEFAULT_SUPABASE_URL = "https://wzkesgtjfoqkbayiuwdh.supabase.co";

export const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6a2VzZ3RqZm9xa2JheWl1d2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjA2ODgsImV4cCI6MjEwMzczNjY4OH0.boU26BYpO068aTs7b5UqRl_kl-jMGr1BzoInzVMQVoc";
