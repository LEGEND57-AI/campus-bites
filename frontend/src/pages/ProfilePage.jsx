import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { userAPI, orderAPI } from '../services/api';
import Navbar from '../components/Navbar';
import {
  User,
  Mail,
  Phone,
  Package,
  Clock,
  CheckCircle,
  ChefHat,
  Bell
} from 'lucide-react';
import toast from 'react-hot-toast';


// ================= ORDER PROGRESS =================

const OrderProgress = ({ status }) => {

  const steps = [
    "Pending",
    "Accepted",
    "Preparing",
    "Ready"
  ];

  const currentIndex = steps.indexOf(status);


  return (

    <div className="flex items-center mt-4">

      {
        steps.map((step, index) => (

          <div
            key={step}
            className="flex items-center flex-1"
          >

            <div
              className={`
                w-7 h-7
                rounded-full
                flex
                items-center
                justify-center
                text-xs
                font-bold
                transition-all

                ${index <= currentIndex
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-200 text-gray-500"
                }
              `}
            >

              {index + 1}

            </div>


            {
              index < steps.length - 1 && (

                <div
                  className={`
                    flex-1
                    h-1
                    mx-2
                    rounded-full

                    ${index < currentIndex
                      ? "bg-blue-600"
                      : "bg-gray-200"
                    }
                  `}
                />

              )
            }

          </div>

        ))
      }

    </div>

  );

};


// ================= PROFILE PAGE =================

const ProfilePage = () => {


  const { user, logout } = useAuth();


  const [orders, setOrders] = useState([]);

  const [profile, setProfile] = useState({
    name: "",
    phone: ""
  });


  const [loading, setLoading] = useState(true);


  // Store previous orders for real-time notification
  const previousOrders = useRef([]);

  // ================= LOAD DATA =================

  useEffect(() => {

    fetchProfile();
    fetchOrders();

    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => clearInterval(interval);

  }, []);


  // ================= GET PROFILE =================

  const fetchProfile = async () => {

    try {

      const { data } = await userAPI.getProfile();

      setProfile(data);

    } catch (error) {

      console.error(error);

      toast.error("Failed to load profile");

    }

  };


  // ================= GET ORDERS =================

  const fetchOrders = async () => {

    try {

      const { data } = await orderAPI.getOrders();


      // Real-time status change notification
      data.forEach((order) => {


        const oldOrder =
          previousOrders.current.find(
            item => item.id === order.id
          );


        if (
          oldOrder &&
          oldOrder.status !== order.status
        ) {


          if (order.status === "Accepted") {

            toast.success(
              `🎉 Token #${String(order.token_number).padStart(2, "0")} accepted by canteen`
            );

          }


          if (order.status === "Preparing") {

            toast(
              `👨‍🍳 Token #${String(order.token_number).padStart(2, "0")} is now preparing`
            );

          }


          if (order.status === "Ready") {


            toast.success(
              `🔔 Token #${String(order.token_number).padStart(2, "0")} is ready for pickup`
            );

          }


          if (order.status === "Rejected") {


            toast.error(
              `❌ Token #${String(order.token_number).padStart(2, "0")} was rejected`
            );

          }

        }

      });


      // Save latest orders
      previousOrders.current = data;


      // Sort latest order first
      const sortedOrders =
        [...data].sort(
          (a, b) =>
            new Date(b.created_at)
            -
            new Date(a.created_at)
        );


      setOrders(sortedOrders);


    } catch (error) {


      console.error(error);


      toast.error(
        "Failed to load orders"
      );

    } finally {


      setLoading(false);

    }

  };


  // ================= TOKEN FORMAT =================

  const formatToken = (order) => {

    if (order.token_number) {

      return `#${String(
        order.token_number
      ).padStart(2, "0")}`;

    }


    // fallback old orders
    return `#${order.id}`;

  };


  // ================= STATUS STYLE =================


  const getStatusStyle = (status) => {


    switch (status) {


      case "Pending":

        return {
          text: "⏳ Pending",
          color: "bg-yellow-100 text-yellow-700"
        };


      case "Accepted":

        return {
          text: "✅ Accepted",
          color: "bg-blue-100 text-blue-700"
        };


      case "Preparing":

        return {
          text: "👨‍🍳 Preparing",
          color: "bg-purple-100 text-purple-700"
        };


      case "Ready":

        return {
          text: "🎉 Ready",
          color: "bg-green-100 text-green-700"
        };


      default:

        return {
          text: status,
          color: "bg-gray-100 text-gray-700"
        };

    }

  };


  // ================= STATUS MESSAGE =================


  const getStatusMessage = (status) => {


    if (status === "Pending")
      return "Waiting for canteen approval";


    if (status === "Accepted")
      return "Your order has been confirmed";


    if (status === "Preparing")
      return "Our chef is preparing your food";


    if (status === "Ready")
      return "Collect your order from the counter";


    return "";

  };

  // ================= UI =================

  return (

    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">

        <div className="grid lg:grid-cols-3 gap-8">


          {/* ================= PROFILE ================= */}

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >

            <div className="
              bg-white
              rounded-3xl
              p-7
              shadow-md
              border
              border-gray-100
            ">


              {/* Avatar */}

              <div className="
                w-28 h-28 mx-auto
                rounded-full
                bg-gradient-to-r
                from-blue-500
                to-cyan-500
                flex items-center justify-center
                shadow-lg
              ">

                <User className="w-14 h-14 text-white" />

              </div>


              <h2 className="text-2xl font-bold text-center mt-5">
                {profile.name || user?.name}
              </h2>


              {/* Student Badge */}

              <div className="text-center">

                <span className="
                  inline-block
                  mt-2
                  px-4 py-1
                  rounded-full
                  bg-blue-100
                  text-blue-700
                  font-semibold
                  text-sm
                ">
                  🎓 Student
                </span>

              </div>


              {/* Contact Details */}

              <div className="
                mt-6
                bg-gray-50
                rounded-2xl
                p-4
                space-y-4
                text-gray-700
              ">

                <div className="flex items-center gap-3">
                  <Mail className="w-5 text-blue-600" />
                  <span>{user?.email}</span>
                </div>


                <div className="flex items-center gap-3">
                  <Phone className="w-5 text-blue-600" />
                  <span>{profile.phone || "No phone"}</span>
                </div>

              </div>


              {/* Logout */}

              <button
                onClick={logout}
                className="
                  w-full mt-6
                  bg-red-500
                  hover:bg-red-600
                  text-white
                  py-3
                  rounded-xl
                  font-semibold
                  transition
                "
              >
                Logout
              </button>


            </div>

          </motion.div>



          {/* ================= ORDERS ================= */}

          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >

            <div className="
              bg-white
              rounded-3xl
              p-6
              shadow-md
              border
              border-gray-100
            ">


              {/* Heading */}

              <h2 className="
                text-2xl
                font-bold
                mb-6
                flex items-center gap-2
              ">

                <Package className="w-6 text-blue-600" />

                My Orders

              </h2>



              {/* Loading */}

              {
                loading ? (

                  <div className="text-gray-500">
                    Loading orders...
                  </div>

                ) : orders.length === 0 ? (

                  <div className="
                    text-center
                    py-10
                    text-gray-500
                  ">

                    🍔 No orders yet

                  </div>

                ) : (


                  <div className="space-y-5">


                    {
                      orders.map((order) => {

                        const status =
                          getStatusStyle(order.status);


                        return (

                          <motion.div
                            key={order.id}
                            whileHover={{
                              y: -3
                            }}
                            className="
                              border
                              border-gray-200
                              rounded-2xl
                              p-5
                              shadow-sm
                              hover:shadow-lg
                              transition
                              bg-white
                            "
                          >


                            {/* Header */}

                            <div className="
                              flex
                              justify-between
                              items-center
                            ">


                              <div>

                                <h3 className="
                                  text-lg
                                  font-bold
                                  text-gray-800
                                ">

                                  🎟 Token {formatToken(order)}

                                </h3>


                                <p className="
                                  text-xs
                                  text-gray-500
                                  mt-1
                                ">

                                  {new Date(
                                    order.created_at
                                  ).toLocaleString()}

                                </p>

                              </div>


                              <span className={`
                                px-3 py-1
                                rounded-full
                                text-xs
                                font-semibold
                                ${status.color}
                              `}>

                                {status.text}

                              </span>

                            </div>



                            {/* Items */}

                            <div className="
                              mt-3
                              flex flex-wrap
                              gap-2
                            ">

                              {
                                order.order_items?.map((item, i) => (

                                  <span
                                    key={i}
                                    className="
                                      bg-gray-100
                                      px-3 py-1
                                      rounded-full
                                      text-sm
                                    "
                                  >

                                    🍽 {item.food_items?.name}
                                    × {item.quantity}

                                  </span>

                                ))
                              }

                            </div>



                            {/* Progress */}

                            <OrderProgress
                              status={order.status}
                            />


                            {/* Message */}

                            <p className="
                              mt-3
                              text-sm
                              text-gray-600
                            ">

                              {getStatusMessage(
                                order.status
                              )}

                            </p>



                            {/* Amount */}

                            <div className="
                              text-right
                              mt-3
                            ">

                              <span className="
                                text-2xl
                                font-bold
                                text-blue-600
                              ">

                                ₹{
                                  Number(
                                    order.total_amount
                                  ).toFixed(2)
                                }

                              </span>

                            </div>


                          </motion.div>

                        );

                      })
                    }


                  </div>

                )
              }


            </div>

          </motion.div>


        </div>

      </main>

    </div>

  );

};


export default ProfilePage;
