import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  User,
  Phone,
  Clock,
  CreditCard,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Hash,
} from "lucide-react";

const formatAmount = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

const formatDateTime = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
};

const formatToken = (order) =>
  order?.token_number ? `#${String(order.token_number).padStart(2, "0")}` : `#${order?.id}`;

const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
    <span className="flex items-center gap-2 text-sm text-slate-500">
      {Icon && <Icon size={14} className="text-slate-400" />}
      {label}
    </span>
    <span className="text-sm font-semibold text-slate-800 text-right">{value}</span>
  </div>
);

const ViewDetailsModal = ({ order, onClose }) => {
  if (!order) return null;

  const items = order.order_items || [];

  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * Number(item.price_at_time || 0),
    0
  );

  // Only rendered if these actually exist on the order — never fabricated
  const hasTax = order.tax_amount !== undefined && order.tax_amount !== null;
  const hasDiscount = order.discount_amount !== undefined && order.discount_amount !== null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed top-0 left-0 right-0 bottom-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{
            duration: 0.3,
            ease: "easeOut",
          }}
          onClick={(e) => e.stopPropagation()}
          className="hide-scrollbar w-full sm:max-w-2xl lg:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
        >
          {/* HEADER */}
          {/* ================= HEADER ================= */}

          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 rounded-t-3xl px-6 py-5">

            <div className="flex items-start justify-between">

              <div>

                <div className="flex items-center gap-3">

                  <h2 className="text-2xl font-bold text-slate-900">
                    Order Details
                  </h2>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${order.status === "Completed"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                      }`}
                  >
                    {order.status === "Completed" ? (
                      <>
                        <CheckCircle2 size={13} />
                        Completed
                      </>
                    ) : (
                      <>
                        <XCircle size={13} />
                        Cancelled
                      </>
                    )}
                  </span>

                </div>

                <div className="mt-4 flex flex-wrap gap-2">

                  <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                    <Hash size={14} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                      #{order.id}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-100 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">
                      Token {formatToken(order)}
                    </span>
                  </div>

                  <div className="rounded-xl bg-slate-100 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">
                      {formatDateTime(order.created_at)}
                    </span>
                  </div>

                </div>

              </div>

              <button
                onClick={onClose}
                className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X size={18} />
              </button>

            </div>

          </div>

          <div className="px-6 py-5 pb-32 space-y-6">


            {/* ================= CUSTOMER ================= */}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">

              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                Customer Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="rounded-xl bg-white p-4 border">

                  <div className="flex items-center gap-3">

                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-lg font-bold shadow-md">
                      {(order.user?.name || "U").charAt(0).toUpperCase()}
                    </div>

                    <div>

                      <p className="text-xs text-slate-400">
                        Customer
                      </p>

                      <h4 className="font-bold text-slate-900">
                        {order.user?.name || "Unknown"}
                      </h4>

                    </div>

                  </div>

                </div>

                <div className="rounded-xl bg-white p-4 border">

                  <div className="flex items-center gap-3">

                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center shadow-md">
                      <Phone className="text-white" size={18} />
                    </div>

                    <div>

                      <p className="text-xs text-slate-400">
                        Phone Number
                      </p>

                      <h4 className="font-bold text-slate-900">
                        +91 {order.user?.phone || "Not Available"}
                      </h4>

                    </div>

                  </div>

                </div>

              </div>

            </div>


            {/* ================= ORDER STATUS ================= */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">

              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-5">
                Order Status
              </h3>

              <div className="space-y-4">

                <div className="flex items-start gap-4">

                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="text-blue-600" size={18} />
                  </div>

                  <div className="flex-1">

                    <p className="text-xs text-slate-400">
                      Order Placed
                    </p>

                    <h4 className="font-semibold text-slate-900">
                      {formatDateTime(order.created_at)}
                    </h4>

                  </div>

                </div>

                <div className="border-t border-dashed border-slate-200"></div>

                <div className="flex items-start gap-4">

                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${order.status === "Completed"
                      ? "bg-green-100"
                      : "bg-red-100"
                      }`}
                  >
                    <ClipboardCheck
                      className={
                        order.status === "Completed"
                          ? "text-green-600"
                          : "text-red-600"
                      }
                      size={18}
                    />
                  </div>

                  <div className="flex-1">

                    <p className="text-xs text-slate-400">
                      Current Status
                    </p>

                    <h4
                      className={`font-bold ${order.status === "Completed"
                        ? "text-green-600"
                        : "text-red-600"
                        }`}
                    >
                      {order.status === "Completed"
                        ? "Completed"
                        : order.status === "Rejected"
                          ? "Cancelled"
                          : order.status}
                    </h4>

                  </div>

                </div>

              </div>

            </div>

            {/* PAYMENT */}
            {/* ================= PAYMENT ================= */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">

              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                Payment Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div className="rounded-xl border bg-slate-50 p-4">

                  <p className="text-xs text-slate-400 mb-1">
                    Payment Method
                  </p>

                  <div className="flex items-center gap-2">

                    <CreditCard size={17} className="text-blue-600" />

                    <span className="font-semibold text-slate-800">
                      {order.payment_method === "CASH"
                        ? "Cash on Delivery"
                        : order.payment_method || "Online"}
                    </span>

                  </div>

                </div>

                <div className="rounded-xl border bg-slate-50 p-4">

                  <p className="text-xs text-slate-400 mb-1">
                    Payment Status
                  </p>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.payment_status === "PAID"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                      }`}
                  >
                    {order.payment_status || "UNKNOWN"}
                  </span>

                </div>

              </div>

            </div>

            {/* ITEMS */}
            {/* ================= ITEMS ================= */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">

              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                Items Ordered
              </h3>

              <div className="space-y-3">

                {items.map((item, i) => (

                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                  >

                    <div>

                      <h4 className="font-semibold text-slate-800">
                        {item.food_items?.name || "Unknown Item"}
                      </h4>

                      <p className="text-xs text-slate-500 mt-1">
                        Qty : {item.quantity}
                      </p>

                    </div>

                    <div className="text-right">

                      <p className="font-bold text-slate-900">
                        {formatAmount(item.quantity * Number(item.price_at_time || 0))}
                      </p>

                      <p className="text-xs text-slate-500">
                        ₹{Number(item.price_at_time || 0).toFixed(2)} each
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            </div>

            {/* AMOUNT BREAKDOWN */}
            {/* ================= BILL SUMMARY ================= */}

            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-5 text-white shadow-lg">

              <h3 className="text-sm uppercase tracking-wide font-semibold text-blue-100 mb-5">
                Bill Summary
              </h3>

              <div className="space-y-3">

                <div className="flex justify-between text-blue-100">
                  <span>Subtotal</span>
                  <span>{formatAmount(subtotal)}</span>
                </div>

                {hasTax && (
                  <div className="flex justify-between text-blue-100">
                    <span>Tax</span>
                    <span>{formatAmount(order.tax_amount)}</span>
                  </div>
                )}

                {hasDiscount && (
                  <div className="flex justify-between text-green-200">
                    <span>Discount</span>
                    <span>-{formatAmount(order.discount_amount)}</span>
                  </div>
                )}

                <div className="border-t border-blue-400 pt-3 flex justify-between">

                  <span className="text-lg font-bold">
                    Total
                  </span>

                  <span className="text-2xl font-extrabold">
                    {formatAmount(order.total_amount)}
                  </span>

                </div>

              </div>

            </div>

          </div>

          <div className="hidden sm:block sticky bottom-0 bg-white border-t border-slate-200 px-6 py-5">

            <button
              onClick={onClose}
              className="w-full rounded-2xl bg-blue-600 py-3.5 text-white font-semibold transition hover:bg-blue-700"
            >
              Close Details
            </button>

          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default ViewDetailsModal;