import React from "react";

import {
    Home,
    UtensilsCrossed,
    ClipboardList,
    Heart,
} from "lucide-react";

import {
    useNavigate,
    useLocation,
} from "react-router-dom";


const MobileBottomNav = () => {

    const navigate = useNavigate();

    const location = useLocation();


    const items = [
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
    ];


    return (

        <nav
            className="
        lg:hidden
        fixed
        bottom-0
        left-0
        right-0
        z-50
        bg-white/95
        backdrop-blur-xl
        border-t
        border-gray-200
        px-2
        py-2
        shadow-[0_-8px_30px_rgba(0,0,0,0.08)]
      "
        >

            <div
                className="
          flex
          items-center
          justify-around
        "
            >

                {
                    items.map((item) => {

                        const Icon = item.icon;

                        const isActive =
                            location.pathname === item.path;


                        return (

                            <button
                                key={item.name}

                                onClick={() =>
                                    navigate(item.path)
                                }

                                className="
                  flex
                  flex-col
                  items-center
                  justify-center
                  gap-1
                  min-w-[65px]
                  py-2
                  rounded-xl
                  transition-all
                  duration-300
                "
                            >


                                <Icon
                                    size={20}

                                    className={
                                        isActive
                                            ? "text-blue-600"
                                            : "text-gray-500"
                                    }
                                />


                                <span
                                    className={`
                    text-[11px]
                    font-medium
                    ${isActive
                                            ? "text-blue-600"
                                            : "text-gray-500"
                                        }
                  `}
                                >

                                    {item.name}

                                </span>


                            </button>

                        );

                    })

                }


            </div>


        </nav>

    );

};


export default MobileBottomNav;