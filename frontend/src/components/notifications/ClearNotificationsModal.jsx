import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Trash2 } from "lucide-react";

// Confirmation for "Clear all" — same design as the student LogoutModal
// (student pages intentionally do not load sweetalert2).
const ClearNotificationsModal = ({
  open,
  busy,
  onClose,
  onConfirm,
}) => {

  return (

    <AnimatePresence>

      {open && (

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="
            fixed
            inset-0
            z-[999]
            bg-black/40
            backdrop-blur-sm
            flex
            items-center
            justify-center
            p-5
          "
          onClick={busy ? undefined : onClose}
        >

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-notifications-title"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="
              w-full
              max-w-md
              rounded-[30px]
              bg-white
              p-8
              shadow-2xl
            "
          >

            <div className="w-20 h-20 rounded-full bg-red-100 mx-auto flex items-center justify-center">
              <Trash2 size={34} className="text-red-600" />
            </div>

            <h2
              id="clear-notifications-title"
              className="mt-6 text-3xl font-bold text-center text-slate-900"
            >
              Clear all
            </h2>

            <p className="mt-3 text-center text-slate-500 leading-7">
              Clear all your notifications? This can't be undone.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">

              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="h-14 rounded-2xl border border-slate-200 font-semibold hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold transition flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {busy && <Loader2 size={18} className="animate-spin" />}
                {busy ? "Clearing..." : "Clear all"}
              </button>

            </div>

          </motion.div>

        </motion.div>

      )}

    </AnimatePresence>

  );

};

export default ClearNotificationsModal;
