import React, { useState } from "react";
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

    try {

      if (items.length === 0) {
        toast.error("Your cart is empty");
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

      console.log(data);

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

            console.log(response);
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

            console.log(verifyData);

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

            console.error(error);

            toast.error(
              error.response?.data?.error ||
              "Payment verification failed"
            );

          }

        },

        modal: {
          ondismiss: function () {
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

      const payload = {

        items: items.map((item) => ({
          foodItemId: item.id,
          quantity: item.quantity,
        })),

        paymentMethod:
          paymentMethod === "cash"
            ? "CASH"
            : "RAZORPAY",

      };

      const { data } =
        await orderAPI.placeOrder(payload);

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

    <div className="min-h-screen bg-[#F4F7FC] p-3 lg:p-5">

      <div
        className="
          bg-white
          rounded-[34px]
          shadow-[0_15px_45px_rgba(0,0,0,0.08)]
          overflow-hidden
          min-h-[calc(100vh-24px)]
          flex
        "
      >

        <Sidebar />

        <div className="flex-1 min-w-0 flex flex-col">

          <DashboardHeader showSearch={false} />

          <main
            className="
              flex-1
              px-5
              lg:px-8
              py-8
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
                        onIncrease={() => updateQuantity(item.id, 1)}
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