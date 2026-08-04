import { supabase } from "../db.js";
import { verifyToken } from "./jwt.js";

export async function getUserFromToken(token) {
  const decoded = verifyToken(token);

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, phone, role")
    .eq("id", decoded.userId)
    .single();

  if (error || !user) {
    throw new Error("Invalid token");
  }

  return user;
}