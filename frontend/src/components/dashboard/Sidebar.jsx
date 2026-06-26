import React from "react";
import logo from "../../assets/CampusCraves-Logo.png";

import {
    Home,
    UtensilsCrossed,
    ClipboardList,
    Heart,
    User,
    Bike,
    ArrowRight,
} from "lucide-react";

import {
    useNavigate,
    useLocation,
} from "react-router-dom";


const Sidebar = () => {


    const navigate = useNavigate();

    const location = useLocation();


    const menuItems = [
        {
            icon: Home,
            name: "Home",
            path: "/",
        },

        {
            icon: UtensilsCrossed,
            name: "Menu",
            path: "/menu",
        },

        {
            icon: ClipboardList,
            name: "Orders",
            path: "/orders",
        },

        {
            icon: Heart,
            name: "Favorites",
            path: "/favorites",
        },

        {
            icon: User,
            name: "Profile",
            path: "/profile",
        },
    ];

    return (

        <aside
            className="
        hidden
        lg:flex
        flex-col
        w-[220px]
        h-[calc(100vh-40px)]
        sticky
        top-5
        bg-white
        border-r
        border-gray-100
        flex-shrink-0
      "
        >


            {/* Logo */}
            <div className="px-8 pt-7 pb-5">

                <img
                    src={logo}
                    alt="CampusCraves Logo"
                    className="
            w-[130px]
            h-auto
            object-contain
          "
                />

            </div>


            {/* Navigation */}
            <div className="px-5 mt-4">

                <div className="space-y-3">          {
                    menuItems.map((item) => {

                        const Icon = item.icon;

                        const isActive =
                            location.pathname === item.path;


                        return (

                            <button
                                key={item.name}

                                onClick={() =>
                                    navigate(item.path)
                                }

                                className={`
                    w-full
                    flex
                    items-center
                    gap-4

                    px-6
                    py-5

                    rounded-[22px]

                    text-[16px]
                    font-medium

                    transition-all
                    duration-300

                    ${isActive
                                        ?
                                        `
                        bg-gradient-to-r
                        from-blue-600
                        to-cyan-500

                        text-white

                        shadow-xl
                        shadow-blue-500/30
                        `
                                        :
                                        `
                        text-gray-600
                        hover:bg-blue-50
                        hover:text-blue-600
                        `
                                    }

                  `}
                            >

                                <Icon size={22} />

                                {item.name}

                            </button>

                        );

                    })

                }

                </div>

            </div>



            {/* Bottom Section */}
            <div
                className="
          mt-auto
          px-5
          pb-5
        "
            >


                {/* Delivery Card */}
                <div
                    className="
            bg-[#F5F9FF]
            rounded-[28px]
            p-6

            text-center

            border
            border-blue-50
          "
                >


                    <div
                        className="
              w-20
              h-20

              mx-auto

              rounded-full
              bg-white

              flex
              items-center
              justify-center

              shadow-sm
            "
                    >

                        <Bike
                            size={34}
                            className="text-blue-600"
                        />

                    </div>


                    <h3
                        className="
              mt-5
              text-[18px]
              font-bold
              text-gray-900
            "
                    >

                        Fast Delivery

                    </h3>


                    <p
                        className="
              mt-2
              text-sm
              text-gray-500
            "
                    >

                        On-time, every time

                    </p>


                    <button
                        className="
              mt-5
              w-full
              h-12

              rounded-xl

              bg-blue-600
              text-white

              font-medium

              flex
              items-center
              justify-center
              gap-2

              transition

              hover:bg-blue-700
            "
                    >

                        Track Order

                        <ArrowRight size={16} />

                    </button>

                </div>


                {/* Footer */}
                <div
                    className="
            mt-8
            px-2

            text-xs
            text-gray-400
            leading-5
          "
                >

                    © 2026 CampusCraves

                    <br />

                    All rights reserved.

                </div>


            </div>


        </aside>

    );

};


export default Sidebar;