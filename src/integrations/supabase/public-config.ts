/**
 * Public browser credentials for the production Supabase project.
 *
 * These values are intentionally safe to ship to the browser: the publishable
 * (anon) key cannot bypass Row Level Security. Environment variables still take
 * precedence so staging or self-hosted deployments can point at another project.
 * Never add the service-role key to this file.
 */
export const DEFAULT_SUPABASE_URL = "https://rdvelndwxluuxryehlds.supabase.co";

export const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdmVsbmR3eGx1dXhyeWVobGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjQ5NzIsImV4cCI6MjEwNTc0MDk3Mn0.G_eZpz58gLn0BCrzpz42Q7uzPcH3XXllxtRoxthXua8";
