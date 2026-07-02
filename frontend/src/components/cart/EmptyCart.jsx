import React from "react";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EmptyCart = () => {

  const navigate = useNavigate();

  return (

    <div
      className="
        bg-white
        rounded-[30px]
        border
        border-slate-200
        py-20
        px-6
        text-center
      "
    >

      <div
        className="
          w-24
          h-24
          rounded-full
          bg-blue-100
          flex
          items-center
          justify-center
          mx-auto
        "
      >

        <ShoppingCart
          size={42}
          className="text-blue-600"
        />

      </div>

      <h2
        className="
          mt-8
          text-3xl
          font-bold
          text-slate-900
        "
      >
        Your Cart is Empty
      </h2>

      <p
        className="
          mt-3
          text-slate-500
          max-w-md
          mx-auto
        "
      >
        Looks like you haven't added anything yet.
        Explore the menu and grab your favourite food.
      </p>

      <button
        onClick={() => navigate("/menu")}
        className="
          mt-8
          h-14
          px-8
          rounded-2xl
          bg-gradient-to-r
          from-blue-600
          to-cyan-500
          text-white
          font-semibold
          inline-flex
          items-center
          gap-3
          hover:scale-105
          transition
        "
      >

        Browse Menu

        <ArrowRight size={18} />

      </button>

    </div>

  );

};

export default EmptyCart;