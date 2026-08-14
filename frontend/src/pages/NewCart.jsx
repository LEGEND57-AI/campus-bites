import React, { useState, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import toast from "react-hot-toast";
import { orderAPI } from "../services/api";
import ConfirmOrderModal from "../components/cart/ConfirmOrderModal";
import { paymentAPI } from "../services/api";

import Sidebar from "../components/dashboard/Sidebar";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import MobileBottomNav from "../components/dashboard/MobileBottomNav";

import CartItem from "../components/cart/CartItem";
import OrderSummary from "../components/cart/OrderSummary";
import EmptyCart from "../components/cart/EmptyCart";


const IDEMPOTENCY_STORAGE_KEY = "campuscraves.cashOrderIdempotency";

// Canonical representation of the cart, mirroring cartFingerprint() in
// backend/routes/orders.js: only food item ids and quantities participate,
// sorted by id so the order items happen to sit in never changes the result,
// and prices are deliberately excluded because a menu price change between two
// attempts does not make it a different order.
//
// Used here to decide whether a stored idempotency key still describes the
// cart being submitted. The backend keeps its own copy of this check as the
// authority; this one only avoids reusing a key for a cart it never belonged
// to, which would otherwise be answered with the backend's 409.
const cartFingerprint = (cartItems) =>
  JSON.stringify(
    cartItems
      .map((item) => [Number(item.id), Number(item.quantity)])
      .sort((a, b) => a[0] - b[0])
  );

// sessionStorage can throw outright (Safari private mode, storage disabled by
// policy). Falling back to a module-scoped value keeps behaviour identical to
// the previous ref-based approach — durable within the tab's lifetime, lost on
// reload — rather than breaking checkout entirely.
let inMemoryIdempotency = null;

const readStoredIdempotency = () => {
  try {
    const raw = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return inMemoryIdempotency;
  }
};

const writeStoredIdempotency = (value) => {
  inMemoryIdempotency = value;

  try {
    if (value === null) {
      sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
    } else {
      sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    // The in-memory fallback above is already updated.
  }
};

// The key to use for this attempt: the stored one when the cart is unchanged,
// so a retry after a reload resolves to the order the first attempt may
// already have created instead of placing a second one. A changed cart is a
// genuinely different order and gets a fresh key.
const getIdempotencyKeyForCart = (fingerprint) => {
  const stored = readStoredIdempotency();

  if (stored && stored.key && stored.fingerprint === fingerprint) {
    return stored.key;
  }

  const key = crypto.randomUUID();

  writeStoredIdempotency({ fingerprint, key });

  return key;
};


const NewCart = () => {

  const navigate = useNavigate();

  const {
    items,
    total,
    updateQuantity,
    removeItem,
    clearCart,
    getItemCount,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);

  // Re-entrancy guard for the online-payment path, held in a ref rather than
  // relying on isStartingPayment: a setState is asynchronous, so two clicks
  // dispatched in the same tick would both observe the old value and both
  // create a Razorpay order. A ref is assigned synchronously and closes that
  // window. Each of those orders would carry a distinct payment id, so
  // orders.payment_id being unique would not stop the user paying twice.
  const onlinePaymentInFlightRef = useRef(false);

  const releaseOnlinePayment = () => {
    onlinePaymentInFlightRef.current = false;
    setIsStartingPayment(false);
  };

  const packaging = items.length > 0 ? 10 : 0;
  const delivery = 0;
  const finalTotal = total;

  const handleCheckout = () => {

    if (paymentMethod === "cash") {

      setShowConfirm(true);

      return;

    }

    // Online Payment
    handleOnlinePayment();

  };

  const handleOnlinePayment = async () => {

    // Already creating an order, or a checkout modal is already open. Without
    // this a double-click opened two Razorpay checkouts for two separate
    // orders, and paying both produced two real charges.
    if (onlinePaymentInFlightRef.current) {
      return;
    }

    onlinePaymentInFlightRef.current = true;
    setIsStartingPayment(true);

    try {

      if (items.length === 0) {
        toast.error("Your cart is empty");
        releaseOnlinePayment();
        return;
      }

      const payload = {

        items: items.map((item) => ({
          foodItemId: item.id,
          quantity: item.quantity,
        })),

      };

      const { data } =
        await paymentAPI.createOrder(payload);



      const options = {
        key: data.key,

        amount: data.order.amount,

        currency: data.order.currency,

        name: "CampusCraves",

        description: "Food Order",

        order_id: data.order.id,

        handler: async function (response) {

          setIsVerifyingPayment(true);
          try {


            // Verify payment
            const verifyPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,

              paymentMethod: "RAZORPAY",

              items: items.map((item) => ({
                foodItemId: item.id,
                quantity: item.quantity,
              })),
            };

            const { data: verifyData } =
              await paymentAPI.verifyPayment(verifyPayload);


            toast.success("Payment Successful 🎉");

            clearCart();

            navigate("/order-success", {
              state: {
                tokenNumber: verifyData.order.token_number,
                total: finalTotal,
                paymentMethod: "RAZORPAY",

                items: items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  quantity: item.quantity,
                })),
              },
            });

          } catch (error) {

            setIsVerifyingPayment(false);

            // Verification failed and the user is back on the cart, so a
            // fresh attempt must be possible.
            releaseOnlinePayment();

            console.error(error);

            toast.error(
              error.response?.data?.error ||
              "Payment verification failed"
            );

          }

        },

        modal: {
          ondismiss: function () {
            // Checkout closed without paying: release the guard so the user
            // can start a genuinely new attempt.
            releaseOnlinePayment();

            toast("Payment Cancelled", {
              icon: "❌",
            });
          },
        },

        theme: {
          color: "#2563eb",
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.open();

    } catch (error) {

      setIsVerifyingPayment(false);

      // Order creation or checkout launch failed; nothing is open, so allow a
      // retry.
      releaseOnlinePayment();

      console.error(error);

      toast.error(
        error.response?.data?.error ||
        "Failed to create payment order"
      );

    }



  };

  const handlePlaceOrder = async () => {

    try {

      setIsPlacingOrder(true);

      // Held in sessionStorage rather than a ref so it survives a reload.
      // Previously a timeout mid-submit followed by a refresh minted a new key
      // and placed a second order, because the cart itself is restored from
      // localStorage and was still there to resubmit.
      const idempotencyKey = getIdempotencyKeyForCart(cartFingerprint(items));

      const payload = {

        items: items.map((item) => ({
          foodItemId: item.id,
          quantity: item.quantity,
        })),

        paymentMethod:
          paymentMethod === "cash"
            ? "CASH"
            : "RAZORPAY",

        idempotencyKey,

      };

      const { data } =
        await orderAPI.placeOrder(payload);

      // The attempt concluded, so the next checkout starts a new one. Cleared
      // before clearCart() below, since clearing the cart changes the
      // fingerprint and a stale entry would only ever be a dead record.
      writeStoredIdempotency(null);

      toast.success("Order placed successfully 🎉");

      clearCart();

      setShowConfirm(false);

      navigate("/order-success", {
        state: {
          tokenNumber: data.order.token_number,
          total: finalTotal,
          paymentMethod:
            paymentMethod === "cash"
              ? "CASH"
              : "RAZORPAY",
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
          })),
        },
      });

    }

    catch (error) {

      console.error(error);

      // Retire the key only when the server gave a definitive client-side
      // answer (bad request, or this key already belongs to a different
      // order) — in those cases no order was created for this payload and the
      // next attempt is genuinely new. After a server error or a network
      // failure the order may in fact have been created, so the key is kept
      // and a retry resolves to that same order instead of duplicating it.
      const status = error.response?.status;

      if (typeof status === "number" && status >= 400 && status < 500) {
        writeStoredIdempotency(null);
      }

      toast.error(
        error.response?.data?.error ||
        "Failed to place order"
      );

    }

    finally {

      setIsPlacingOrder(false);

    }

  };

  if (isVerifyingPayment) {
    return (
      <div className="min-h-screen bg-[#F4F7FC] flex items-center justify-center">

        <div className="bg-white rounded-[32px] shadow-xl p-10 text-center max-w-md w-full">

          <div
            className="
            w-16
            h-16
            mx-auto
            rounded-full
            border-4
            border-blue-200
            border-t-blue-600
            animate-spin
          "
          />

          <h2 className="mt-8 text-2xl font-bold text-slate-900">
            Verifying Payment...
          </h2>

          <p className="mt-3 text-slate-500 leading-7">
            Please wait while we verify your payment and create your order.
          </p>

        </div>

      </div>
    );
  }


  return (

    <div className="min-h-screen bg-[#F4F7FC] p-0 md:p-3 lg:p-5">

      <div
        className="
      bg-white
      flex
      min-h-screen

      rounded-none
      shadow-none
      overflow-visible

      md:rounded-[34px]
      md:overflow-hidden
      md:min-h-[calc(100vh-24px)]
      md:shadow-[0_15px_45px_rgba(0,0,0,0.08)]
    "
      >

        <Sidebar />

        <div className="flex-1 min-w-0 flex flex-col">

          <DashboardHeader showSearch={false} />

          <main
            className="
    flex-1
    px-3
    sm:px-4
    md:px-6
    lg:px-8
    py-5
    md:py-8
    pb-28
  "
          >

            <button
              onClick={() => navigate(-1)}
              className="
                flex
                items-center
                gap-2
                text-blue-600
                hover:text-blue-700
                font-medium
                mb-8
              "
            >
              <ArrowLeft size={18} />

              Continue Shopping

            </button>

            <div className="mb-10">

              <h1
                className="
                  text-4xl
                  lg:text-5xl
                  font-bold
                  text-slate-900
                "
              >
                Your Cart
              </h1>

              <p
                className="
                  mt-3
                  text-slate-500
                "
              >
                Review your order before checkout.
              </p>

            </div>

            <div
              className="
                grid
                grid-cols-1
                xl:grid-cols-12
                gap-8
              "
            >

              {/* LEFT SIDE */}

              <section className="xl:col-span-8">

                {/* Cart Header */}

                <div
                  className="
                    bg-white
                    border
                    border-slate-200
                    rounded-[28px]
                    p-6
                    mb-6
                  "
                >

                  <div
                    className="
                      flex
                      flex-col
                      lg:flex-row
                      lg:items-center
                      lg:justify-between
                      gap-4
                    "
                  >

                    <div>

                      <h2 className="text-2xl font-bold text-slate-900">
                        Cart Items
                      </h2>

                      <p className="text-slate-500 mt-1">
                        {getItemCount()} delicious items in your cart
                      </p>

                    </div>

                    <button
                      onClick={clearCart}
                      className="
                        h-11
                        px-5
                        rounded-xl
                        border
                        border-red-200
                        text-red-500
                        hover:bg-red-50
                        transition
                      "
                    >
                      Clear Cart
                    </button>

                  </div>

                </div>

                {/* Cart Items */}

                {items.length === 0 ? (

                  <EmptyCart />

                ) : (

                  <div className="space-y-5">

                    {items.map((item) => (

                      <CartItem
                        key={item.id}
                        item={{
                          ...item,
                          image: item.image || item.image_url,
                        }}
                        onIncrease={() => {

                          if (item.quantity >= 10) {
                            toast.error("Maximum 10 quantity allowed");
                            return;
                          }

                          updateQuantity(item.id, 1);

                        }}
                        onDecrease={() => updateQuantity(item.id, -1)}
                        onRemove={() => removeItem(item.id)}
                      />

                    ))}

                  </div>

                )}


              </section>

              {/* RIGHT SIDE */}

              {items.length > 0 && (

                <aside className="xl:col-span-4">

                  <OrderSummary
                    subtotal={total}
                    packaging={packaging}
                    delivery={delivery}
                    total={finalTotal}
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    onPlaceOrder={handleCheckout}
                    disabled={isStartingPayment}
                  />

                  {/* Security Info */}

                  <div
                    className="
                    mt-6
                    rounded-[24px]
                    bg-slate-50
                    border
                    border-slate-200
                    p-5
                  "
                  >

                    <h3 className="text-lg font-bold text-slate-900">
                      Safe Checkout
                    </h3>

                    <p className="mt-2 text-sm text-slate-500 leading-6">
                      Your payments are securely processed. CampusCraves never
                      stores your card information.
                    </p>

                  </div>

                </aside>
              )}

            </div>

          </main>

          <ConfirmOrderModal
            open={showConfirm}
            onClose={() => setShowConfirm(false)}
            onConfirm={handlePlaceOrder}
            loading={isPlacingOrder}
            itemCount={getItemCount()}
            total={finalTotal}
            paymentMethod={paymentMethod}
          />

          <MobileBottomNav />

        </div>

      </div>

    </div>
  );
};

export default NewCart;