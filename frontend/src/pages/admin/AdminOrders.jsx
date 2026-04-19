import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api'; // 🔥 IMPORTANT CHANGE
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await adminAPI.getOrders(); // 🔥 FIX

      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        console.error('Expected array, got:', data);
        setOrders([]);
        toast.error(data?.error || 'Invalid orders data');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await adminAPI.updateOrderStatus(orderId, newStatus); // 🔥 FIX
      toast.success(`Order #${orderId} marked as ${newStatus}`);
      fetchOrders();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Accepted': return 'bg-blue-100 text-blue-700';
      case 'Preparing': return 'bg-indigo-100 text-indigo-700';
      case 'Ready': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-xl"></div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return <p className="text-gray-500">No orders yet.</p>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Manage Orders</h2>
      <div className="space-y-4">
        {orders.map((order) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-5 rounded-xl shadow-md"
          >
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold">Order #{order.id}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>

                <p className="mt-2 text-gray-700">
                  Customer: {order.user?.name} ({order.user?.email})
                </p>

                <div className="mt-2 text-sm text-gray-600">
                  Items: {order.order_items?.map(i => `${i.quantity}x ${i.food_items?.name}`).join(', ')}
                </div>

                <p className="mt-1 font-bold text-blue-600">
                  Total: ₹{order.total_amount}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {order.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => updateStatus(order.id, 'Accepted')}
                      className="bg-green-500 text-white text-sm py-1 px-3 rounded-lg hover:bg-green-600"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, 'Rejected')}
                      className="bg-red-500 text-white text-sm py-1 px-3 rounded-lg hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </>
                )}

                {order.status === 'Accepted' && (
                  <button
                    onClick={() => updateStatus(order.id, 'Preparing')}
                    className="bg-blue-500 text-white text-sm py-1 px-3 rounded-lg hover:bg-blue-600"
                  >
                    Start Preparing
                  </button>
                )}

                {order.status === 'Preparing' && (
                  <button
                    onClick={() => updateStatus(order.id, 'Ready')}
                    className="bg-indigo-500 text-white text-sm py-1 px-3 rounded-lg hover:bg-indigo-600"
                  >
                    Mark Ready
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminOrders;