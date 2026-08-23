// Cart size limits, shared by every path that accepts a cart from a client.
//
// These were previously written out as literals at each validation site, and
// they drifted: routes/orders.js capped a single item at 10 while
// routes/payment.js allowed 20, so the online Razorpay flow accepted carts the
// cash flow and the UI both refused. That was never a payment-integrity
// problem -- prices and totals are read from the database and computed
// server-side either way, so an oversized cart was still charged correctly --
// but it let one payment method exceed a limit the other enforced. Defining
// the numbers once means the two cannot diverge again.
//
// 10 matches what the frontend stepper already allows (components/FoodCard.jsx
// and pages/NewCart.jsx) and every order ever placed: across 2,027 order_items
// rows the largest quantity recorded is exactly 10.
//
// Deliberately enforced only where a cart is first accepted -- POST /orders and
// POST /payment/create-order. Nothing downstream of a captured payment
// (/payment/verify, the webhook, or the order-creation RPCs) applies a maximum,
// because rejecting an already-paid intent would take a customer's money
// without producing an order.

// Largest quantity a single food item may be ordered in.
export const MAX_ITEM_QUANTITY = 10;

// Largest number of different food items one order may contain.
export const MAX_DISTINCT_ITEMS = 10;
