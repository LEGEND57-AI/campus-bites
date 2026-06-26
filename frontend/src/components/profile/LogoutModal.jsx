import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";

const LogoutModal = ({
  open,
  onClose,
  onLogout,
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

          onClick={onClose}

        >

          <motion.div

            initial={{
              opacity: 0,
              scale: 0.9,
              y: 20,
            }}

            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}

            exit={{
              opacity: 0,
              scale: 0.9,
            }}

            transition={{
              duration: 0.25,
            }}

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

            {/* Icon */}

            <div
              className="
                w-20
                h-20
                rounded-full
                bg-red-100
                mx-auto
                flex
                items-center
                justify-center
              "
            >

              <LogOut
                size={34}
                className="text-red-600"
              />

            </div>

            {/* Title */}

            <h2
              className="
                mt-6
                text-3xl
                font-bold
                text-center
                text-slate-900
              "
            >

              Logout

            </h2>

            {/* Description */}

            <p
              className="
                mt-3
                text-center
                text-slate-500
                leading-7
              "
            >

              Are you sure you want to logout from
              your CampusCraves account?

            </p>

            {/* Buttons */}

            <div
              className="
                mt-8
                grid
                grid-cols-2
                gap-4
              "
            >

              <button

                onClick={onClose}

                className="
                  h-14
                  rounded-2xl
                  border
                  border-slate-200
                  font-semibold
                  hover:bg-slate-50
                  transition
                "

              >

                Cancel

              </button>

              <button

                onClick={onLogout}

                className="
                  h-14
                  rounded-2xl
                  bg-red-500
                  hover:bg-red-600
                  text-white
                  font-semibold
                  transition
                "

              >

                Logout

              </button>

            </div>

          </motion.div>

        </motion.div>

      )}

    </AnimatePresence>

  );

};

export default LogoutModal;