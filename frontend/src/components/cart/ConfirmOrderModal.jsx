import React from "react";
import { AlertCircle, X } from "lucide-react";

const ConfirmOrderModal = ({
  open,
  onClose,
  onConfirm,
  loading,
  itemCount,
  total,
  paymentMethod,
}) => {

  if (!open) return null;

  return (

    <div
      className="
        fixed
        inset-0
        z-[100]
        bg-black/45
        backdrop-blur-sm
        flex
        items-center
        justify-center
        p-5
      "
    >

      <div
        className="
          bg-white
          rounded-[32px]
          w-full
          max-w-md
          shadow-2xl
          overflow-hidden
        "
      >

        {/* Header */}

        <div className="relative px-8 pt-8">

          <button
            onClick={onClose}
            className="
              absolute
              right-5
              top-5
              w-10
              h-10
              rounded-full
              hover:bg-slate-100
              flex
              items-center
              justify-center
            "
          >
            <X size={18} />
          </button>

          <div
            className="
              w-20
              h-20
              rounded-full
              bg-blue-100
              mx-auto
              flex
              items-center
              justify-center
            "
          >
            <AlertCircle
              size={42}
              className="text-blue-600"
            />
          </div>

          <h2
            className="
              mt-6
              text-center
              text-3xl
              font-bold
              text-slate-900
            "
          >
            Confirm Order?
          </h2>

        </div>

        {/* Body */}

        <div className="px-8 py-6">

          <div className="space-y-3 text-slate-700">

            <div className="flex justify-between">

              <span>Items</span>

              <strong>{itemCount}</strong>

            </div>

            <div className="flex justify-between">

              <span>Total</span>

              <strong>₹{total}</strong>

            </div>

            <div className="flex justify-between">

              <span>Payment</span>

              <strong>
                {paymentMethod === "cash"
                  ? "Cash on Counter"
                  : "Online Payment"}
              </strong>

            </div>

          </div>

          <p
            className="
              mt-8
              text-center
              text-slate-500
            "
          >
            Are you sure you want to place this order?
          </p>

        </div>

        {/* Footer */}

        <div className="px-8 pb-8 flex gap-4">

          <button
            onClick={onClose}
            className="
              flex-1
              h-14
              rounded-2xl
              border
              border-slate-300
              font-semibold
            "
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="
              flex-1
              h-14
              rounded-2xl
              bg-gradient-to-r
              from-blue-600
              to-cyan-500
              text-white
              font-semibold
            "
          >

            {loading
              ? "Processing..."
              : "Place Order"}

          </button>

        </div>

      </div>

    </div>

  );

};

export default ConfirmOrderModal;