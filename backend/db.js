import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

console.log("ENV CHECK:");
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export { supabase };