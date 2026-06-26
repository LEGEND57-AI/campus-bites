import React from "react";
import { motion } from "framer-motion";

const HeroBanner = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            className="
                relative
                z-0
                overflow-hidden
                rounded-[32px]
                bg-gradient-to-br
                from-blue-700
                via-blue-600
                to-cyan-500
                p-6
                lg:p-10
                text-white
                shadow-xl
                pointer-events-none
            "
        >

            {/* Background Curves */}
            <div
                className="
                    absolute
                    -right-10
                    top-0
                    w-[280px]
                    h-[280px]
                    bg-white/10
                    rounded-full
                    pointer-events-none
                    z-0
                "
            />

            <div
                className="
                    absolute
                    left-1/2
                    top-0
                    w-[250px]
                    h-[250px]
                    bg-white/5
                    rounded-full
                    pointer-events-none
                    z-0
                "
            />


            <div
                className="
                    relative
                    z-10
                    h-full
                    flex
                    items-center
                    justify-between
                "
            >

                {/* Left Content */}
                <div className="max-w-[55%] lg:max-w-[45%]">

                    <p className="text-blue-100 text-xs lg:text-base mb-2">
                        Hey LEGEND57 👋
                    </p>

                    <h1
                        className="
                            font-bold
                            leading-tight
                            text-3xl
                            lg:text-6xl
                        "
                    >
                        What's for
                        <br />
                        lunch today?
                    </h1>

                    <p
                        className="
                            mt-3
                            text-blue-100
                            text-sm
                            lg:text-lg
                        "
                    >
                        Fresh, fast & delicious meals on your campus 🍔
                    </p>

                </div>


                {/* Right Food Image */}
                <div
                    className="
                        absolute
                        right-2
                        bottom-0
                        lg:right-8
                        lg:bottom-0
                        pointer-events-none
                        z-0
                    "
                >

                    <img
                        src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
                        alt="Healthy Food"
                        className="
                            object-cover
                            rounded-full
                            w-[140px]
                            h-[140px]
                            lg:w-[340px]
                            lg:h-[340px]
                            shadow-2xl
                            border-[8px]
                            border-white/20
                            pointer-events-none
                        "
                    />

                </div>

            </div>

        </motion.div>
    );
};

export default HeroBanner;