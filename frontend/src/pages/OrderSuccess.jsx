import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const OrderSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const orderId = location.state?.orderId;
  const total = location.state?.total;
  const items = location.state?.items || [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow text-center w-[400px]">

        <h1 className="text-2xl font-bold text-green-600 mb-4">
          ✅ Order Placed Successfully!
        </h1>

        <p className="text-gray-600 mb-4">
          Your food is being prepared 🍳
        </p>

        {/* 🔥 ORDER DETAILS */}
        <div className="bg-gray-100 p-4 rounded-lg text-left mb-4">

          <p><strong>Order ID:</strong> #{orderId || 'N/A'}</p>
          <p><strong>Total:</strong> ₹{total?.toFixed(2) || '0.00'}</p>
          <p><strong>Status:</strong> Preparing 🍳</p>

          {/* 🔥 ITEMS LIST */}
          <div className="mt-3">
            <p className="font-semibold mb-1">Items:</p>
            {items.length === 0 ? (
              <p className="text-gray-500 text-sm">No items</p>
            ) : (
              items.map((item, index) => (
                <p key={index} className="text-sm">
                  {item.name} x{item.quantity}
                </p>
              ))
            )}
          </div>

        </div>

        <button
          onClick={() => navigate('/profile')}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full"
        >
          Go to Orders
        </button>

      </div>
    </div>
  );
};

export default OrderSuccess;