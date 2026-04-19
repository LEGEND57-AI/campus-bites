import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { orderAPI } from '../services/api';
import Navbar from '../components/Navbar';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

const CartPage = () => {
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const formatPrice = (price) => Number(price).toFixed(2);

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error('Please login to place order');
      navigate('/login');
      return;
    }

    if (user.role !== 'student') {
      toast.error('Only students can place orders');
      return;
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsPlacingOrder(true);

    try {
      const orderItems = items.map(item => ({
        foodItemId: item.id,
        quantity: item.quantity
      }));

      const response = await orderAPI.placeOrder(orderItems);

      clearCart();
      toast.success('Order placed successfully!');

      // 🔥 FIX: redirect to success page + pass data
      navigate('/order-success', {
        state: {
          orderId: response?.data?.order?.id,
          total: total,
          items: items   // 🔥 ADD THIS
        }
      });

    } catch (error) {
      console.error(error);
      toast.error('Failed to place order');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl text-gray-500">Cart is empty</h2>
          <Link to="/" className="btn-primary mt-4 inline-block">
            Go to Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto p-6 grid lg:grid-cols-3 gap-6">

        {/* ITEMS */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl flex gap-4 shadow">

              <img
                src={item.image_url || "https://via.placeholder.com/100"}
                className="w-20 h-20 rounded object-cover"
              />

              <div className="flex-1">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-blue-600 font-bold">
                  ₹{formatPrice(item.price)}
                </p>

                <div className="flex items-center gap-3 mt-2">

                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    <Minus size={16} />
                  </button>

                  <span className="font-semibold">{item.quantity}</span>

                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    <Plus size={16} />
                  </button>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="ml-auto text-red-500 hover:text-red-600"
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>

              <div className="font-bold text-lg">
                ₹{formatPrice(item.price * item.quantity)}
              </div>
            </div>
          ))}
        </div>

        {/* SUMMARY */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-bold mb-4">Summary</h2>

          <p className="text-lg">
            Total: <span className="font-bold">₹{formatPrice(total)}</span>
          </p>

          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="btn-primary w-full mt-4"
          >
            {isPlacingOrder ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;