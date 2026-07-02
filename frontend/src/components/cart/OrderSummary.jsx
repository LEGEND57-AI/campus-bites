import React from "react";
import {
    Wallet,
    CreditCard,
    Info,
    ArrowRight,
} from "lucide-react";

const OrderSummary = ({
    subtotal = 190,
    packaging = 10,
    delivery = 20,
    total = 220,
    paymentMethod = "cash",
    setPaymentMethod = () => { },
    onPlaceOrder = () => { },
}) => {
    return (
        <div
            className="
        bg-white
        border
        border-slate-200
        rounded-[28px]
        p-6
        sticky
        top-6
        shadow-sm
      "
        >
            {/* Heading */}

            <h2 className="text-2xl font-bold text-slate-900">
                Order Summary
            </h2>

            {/* Price Details */}

            <div className="mt-8 space-y-5">

                <div className="flex justify-between">
                    <span className="text-slate-500">
                        Subtotal
                    </span>

                    <span className="font-semibold">
                        ₹{subtotal}
                    </span>
                </div>



            </div>

            {/* Divider */}

            <div className="border-t border-slate-200 my-7" />

            {/* Total */}

            <div className="flex justify-between items-center">

                <div>

                    <p className="text-slate-500">
                        Total Amount
                    </p>

                    <h2 className="text-3xl font-bold text-blue-600 mt-1">
                        ₹{total}
                    </h2>

                </div>

            </div>

            {/* Payment */}

            <div className="mt-10">

                <h3 className="font-bold text-lg mb-4">
                    Choose Payment Method
                </h3>

                {/* Cash */}

                <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`
            w-full
            flex
            justify-between
            items-center
            p-5
            rounded-2xl
            border
            transition

            ${paymentMethod === "cash"
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200"
                        }
          `}
                >
                    <div className="flex gap-4">

                        <Wallet
                            className="text-blue-600"
                        />

                        <div className="text-left">

                            <h4 className="font-semibold">
                                Cash on Counter
                            </h4>

                            <p className="text-sm text-slate-500">
                                Pay while collecting
                            </p>

                        </div>

                    </div>

                    <div
                        className={`
              w-5
              h-5
              rounded-full
              border-2

              ${paymentMethod === "cash"
                                ? "border-blue-600 bg-blue-600"
                                : "border-slate-300"
                            }
            `}
                    />

                </button>

                {/* Online */}

                <button
                    onClick={() => setPaymentMethod("online")}
                    className={`
            mt-4
            w-full
            flex
            justify-between
            items-center
            p-5
            rounded-2xl
            border
            transition

            ${paymentMethod === "online"
                            ? "border-blue-600 bg-blue-50"
                            : "border-slate-200"
                        }
          `}
                >
                    <div className="flex gap-4">

                        <CreditCard
                            className="text-green-600"
                        />

                        <div className="text-left">

                            <h4 className="font-semibold">
                                Online Payment
                            </h4>

                            <p className="text-sm text-slate-500">
                                UPI, Card, Wallet
                            </p>

                        </div>

                    </div>

                    <div
                        className={`
              w-5
              h-5
              rounded-full
              border-2

              ${paymentMethod === "online"
                                ? "border-blue-600 bg-blue-600"
                                : "border-slate-300"
                            }
            `}
                    />

                </button>

            </div>

            {/* Place Order */}

            <button
                onClick={onPlaceOrder}
                className="
    mt-8
    w-full
    h-14
    rounded-2xl
    bg-gradient-to-r
    from-blue-600
    to-cyan-500
    text-white
    font-semibold
    flex
    items-center
    justify-center
    gap-3
    hover:scale-[1.02]
    transition
  "
            >
                {paymentMethod === "cash"
                    ? "Place Cash Order"
                    : `Pay ₹${total}`}

                <ArrowRight size={18} />

            </button>

        </div>
    );
};

export default OrderSummary;