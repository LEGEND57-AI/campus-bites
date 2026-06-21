import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const OrderSuccess = () => {

  const location = useLocation();
  const navigate = useNavigate();

  const tokenNumber = location.state?.tokenNumber;
  const total = location.state?.total;
  const items = location.state?.items || [];
  const paymentMethod = location.state?.paymentMethod;

  const isCash = paymentMethod === "CASH";


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-3">

      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-5">


        {/* Success Icon */}
        <div className="flex justify-center mb-3">

          <div className="
            w-16 h-16 
            rounded-full 
            bg-green-100 
            flex 
            items-center 
            justify-center 
            text-3xl">

            ✅

          </div>

        </div>


        {/* Heading */}

        <h1 className="text-2xl font-bold text-green-600 text-center">

          Order Confirmed

        </h1>


        <p className="text-center text-gray-500 text-sm mt-1">

          {
            isCash
              ? "Your order has been received. Please pay at the counter."
              : "Payment received successfully. Your food will be prepared shortly."
          }

        </p>


        {/* Order Token */}

        <div className="
          mt-4 
          bg-blue-600 
          text-white 
          rounded-2xl 
          py-3 px-5 
          text-center">

          <p className="text-xs opacity-90">
            ORDER TOKEN
          </p>

          <h2 className="text-3xl font-bold">

            {
              tokenNumber
                ? `#${String(tokenNumber).padStart(2, "0")}`
                : "N/A"
            }

          </h2>

        </div>



        {/* Receipt */}

        <div className="mt-4 border rounded-xl p-3">


          <div className="flex justify-between mb-2">

            <span className="font-medium">
              Total Amount
            </span>


            <span className="font-bold text-blue-600">

              ₹{total?.toFixed(2) || "0.00"}

            </span>

          </div>



          <div className="flex justify-between mb-2">

            <span>
              Payment
            </span>


            <span>

              {
                isCash
                  ? "💵 Cash"
                  : "📱 Online"
              }

            </span>

          </div>



          <div className="flex justify-between mb-2">

            <span>
              Payment Status
            </span>


            <span
              className={`
                px-3 py-1 
                rounded-full 
                text-xs 
                font-semibold

                ${isCash
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
                }
              `}
            >

              {
                isCash
                  ? "Pending"
                  : "Paid"
              }

            </span>

          </div>



          <div className="border-t pt-2 mt-2">


            <h3 className="font-semibold mb-1">

              🍽 Ordered Items

            </h3>


            {
              items.map((item, index) => (

                <div
                  key={index}
                  className="flex justify-between text-sm"
                >

                  <span>

                    {item.name}

                  </span>


                  <span>

                    × {item.quantity}

                  </span>


                </div>

              ))
            }


          </div>


        </div>



        {/* Bottom Message */}

        <div className="
          mt-3 
          bg-gray-100 
          rounded-xl 
          p-2 
          text-center">

          {
            isCash

              ?

              <p className="text-sm text-gray-700">

                💰 Pay at the counter. Your order will start preparing after payment confirmation.

              </p>

              :

              <p className="text-sm text-gray-700">

                ⏱ Estimated preparation time: 10 - 15 minutes.

              </p>
          }


        </div>



        {/* Button */}

        <button
          onClick={() => navigate("/profile")}
          className="
            mt-4
            w-full
            bg-blue-600
            hover:bg-blue-700
            text-white
            py-2.5
            rounded-xl
            font-semibold
            transition
          "
        >

          View My Orders

        </button>


      </div>


    </div>
  );

};


export default OrderSuccess;