import { supabase } from "../db.js";
import { createNotification } from "./notificationService.js";
import {
  emitOrderUpdate,
  emitAdminOrderUpdate,
} from "../socket/emitters.js";

export async function autoCancelExpiredCashOrders() {
  const now = new Date().toISOString();

  // The filter is unchanged. .select() is added so the rows this run actually
  // transitioned are returned and can be announced below.
  //
  // status = 'Pending' in the filter is what makes re-running safe: a row this
  // run cancelled is left at 'Rejected', so a later run cannot match it again
  // and cannot notify the same order twice. The transition and the selection
  // are the same statement, so a row is only ever returned to the run that
  // actually changed it -- two concurrent runs cannot both claim it.
  const { data: cancelledOrders, error } = await supabase
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
    .lt("payment_due_at", now)
    .select();

  if (error) {
    console.error("Auto Cancel Error:", error);
    return;
  }

  if (!cancelledOrders?.length) {
    return;
  }

  // Announced with exactly the shape routes/admin.js uses for an admin-driven
  // "Rejected" transition, so an order that times out is indistinguishable to
  // the client from one an admin rejected. Previously this job changed status
  // silently: the customer was never told, and no dashboard refreshed.
  //
  // createNotification already emits NOTIFICATION_NEW and dispatches the web
  // push itself, so it must not be paired with a separate emitNotification
  // call here or every customer would be notified twice.
  for (const order of cancelledOrders) {
    try {
      await createNotification({
        userId: order.user_id,
        title: "Order Cancelled",
        message:
          order.cancel_reason ||
          `Your Token #${order.token_number} has been cancelled.`,
        type: "order_cancelled",
        priority: "high",
        orderId: order.id,
        tokenNumber: order.token_number,
        actionUrl: `/track-order/${order.id}`,
      });

      emitOrderUpdate(order.user_id, order);
      emitAdminOrderUpdate(order);
    } catch (notifyError) {
      // The cancellation itself is already committed and must stand. One
      // order failing to notify must not abort the loop and leave the rest of
      // this batch unannounced.
      console.error(
        "Auto Cancel notification failed:",
        order.id,
        notifyError?.message || notifyError
      );
    }
  }
}
