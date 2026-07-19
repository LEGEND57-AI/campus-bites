import { supabase } from "../db.js";

export async function autoCancelExpiredCashOrders() {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update({
      status: "Rejected",
      payment_status: "CANCELLED",
      cancel_reason: "Payment Timeout",
      cancelled_by: "SYSTEM",
    })
    .eq("status", "Pending")
    .eq("payment_method", "CASH")
    .eq("payment_status", "PENDING")
    .lt("payment_due_at", now);

  if (error) {
    console.error("Auto Cancel Error:", error);
  }
}