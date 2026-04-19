import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { userAPI, orderAPI } from '../services/api';
import Navbar from '../components/Navbar';
import { User, Mail, Phone, Package } from 'lucide-react';
import toast from 'react-hot-toast';

const OrderProgress = ({ status }) => {
  const steps = ['Pending', 'Accepted', 'Preparing', 'Ready'];
  const currentIndex = steps.indexOf(status);

  return (
    <div className="flex items-center mt-3">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center flex-1">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${index <= currentIndex ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'}`}
          >
            {index + 1}
          </div>

          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-1 mx-2
                ${index < currentIndex ? 'bg-blue-500' : 'bg-gray-300'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(true);

  // 🔥 IMPORTANT: previous orders store
  const prevOrdersRef = useRef([]);

  useEffect(() => {
    fetchProfile();
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await userAPI.getProfile();
      setProfile(data);
    } catch {
      toast.error('Failed to load profile');
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await orderAPI.getOrders();

      // 🔥 STATUS CHANGE DETECTION
      data.forEach(order => {
        const prevOrder = prevOrdersRef.current.find(o => o.id === order.id);

        if (prevOrder && prevOrder.status !== order.status) {

          if (order.status === 'Accepted') {
            toast.success('Your order has been accepted 👍', {
              id: `order-${order.id}`
            });
          }

          else if (order.status === 'Preparing') {
            toast.success('Your order is being prepared 🍳', {
              id: `order-${order.id}`
            });
          }

          else if (order.status === 'Ready') {
            toast.success('Your order is ready! 🎉', {
              id: `order-${order.id}`
            });
          }

          else if (order.status === 'Rejected') {
            toast.error('Your order was rejected ❌', {
              id: `order-${order.id}`
            });
          }
        }
      });

      // 🔥 UPDATE REFERENCE
      prevOrdersRef.current = data;

      setOrders(data);

    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    return `
      px-3 py-1 rounded-full text-xs font-semibold
      ${status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
        status === 'Accepted' ? 'bg-blue-100 text-blue-700' :
          status === 'Preparing' ? 'bg-purple-100 text-purple-700' :
            status === 'Ready' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-700'
      }
    `;
  };

  const getStatusMessage = (status) => {
    if (status === 'Pending') return 'Waiting for approval';
    if (status === 'Accepted') return 'Order confirmed';
    if (status === 'Preparing') return 'Food is being prepared';
    if (status === 'Ready') return 'Ready for pickup';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* PROFILE */}
          <motion.div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 text-center">
              <div className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mb-4">
                <User className="w-12 h-12 text-white" />
              </div>

              <h2 className="text-xl font-bold">{profile.name || user?.name}</h2>
              <p className="text-gray-500">Student</p>

              <div className="mt-4 space-y-2 text-gray-600">
                <p><Mail className="inline w-4 mr-2" />{user?.email}</p>
                <p><Phone className="inline w-4 mr-2" />{profile.phone}</p>
              </div>

              <button
                onClick={logout}
                className="w-full mt-6 bg-red-500 text-white py-2 rounded-xl"
              >
                Logout
              </button>
            </div>
          </motion.div>

          {/* ORDERS */}
          <motion.div className="lg:col-span-2">
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Package className="w-5 text-blue-500" /> Order History
              </h2>

              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                    <div key={order.id} className="p-4 border rounded-xl">

                      <div className="flex justify-between">
                        <p className="font-semibold">Order #{order.id}</p>
                        <span className={getStatusColor(order.status)}>
                          {order.status}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(order.created_at).toLocaleString()}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {order.order_items?.map((item, i) => (
                          <span key={i} className="bg-gray-100 px-2 py-1 rounded-full text-sm">
                            {item.food_items?.name} x{item.quantity}
                          </span>
                        ))}
                      </div>

                      <OrderProgress status={order.status} />

                      <p className="text-xs text-gray-500 mt-2">
                        {getStatusMessage(order.status)}
                      </p>

                      <p className="text-right font-bold text-blue-600 mt-2">
                        ₹{Number(order.total_amount).toFixed(2)}
                      </p>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
};

export default ProfilePage;