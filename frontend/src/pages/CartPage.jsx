import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Minus, Plus, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { orderAPI, paymentAPI } from '../services/api';

const PAYMENT_METHODS = {
  CASH: 'CASH',
  RAZORPAY: 'RAZORPAY',
};

const formatPrice = (price) => `Rs.${Number(price || 0).toFixed(2)}`;

const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');

    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => {
      resolve(true);
    };

    script.onerror = () => {
      resolve(false);
    };

    document.body.appendChild(script);
  });
};

const CartPage = () => {
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS.CASH);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  const handleRazorpayPayment = async () => {

    try {

      // Load Razorpay SDK
      const loaded = await loadRazorpay();

      if (!loaded) {
        toast.error("Razorpay SDK failed to load");
        return;
      }


      // Create Razorpay Order from backend
      const response = await paymentAPI.createOrder(total);


      const {
        key,
        order
      } = response.data;


      const options = {

        key: key,

        amount: order.amount,

        currency: order.currency,

        name: "CampusBites",

        description: "Food Order Payment",

        order_id: order.id,


        // Payment Success
        handler: async function (response) {

          setIsVerifyingPayment(true);

          try {


            // Prepare cart items for backend
            const orderItems = items.map(item => ({

              foodItemId: item.id,

              quantity: item.quantity

            }));


            // Verify Razorpay payment
            const verifyResponse =
              await paymentAPI.verifyPayment({

                razorpay_order_id:
                  response.razorpay_order_id,

                razorpay_payment_id:
                  response.razorpay_payment_id,

                razorpay_signature:
                  response.razorpay_signature,

                items: orderItems

              });


            // Save details before clearing cart
            const orderedItems = [...items];

            const orderedTotal = total;

            // Clear cart
            clearCart();

            // Success message
            toast.success(
              "Payment successful! Order placed successfully."
            );

            // Redirect to receipt page
            navigate("/order-success", {
              state: {
                tokenNumber:
                  verifyResponse.data.order.token_number,
                total:
                  orderedTotal,
                items:
                  orderedItems,
                paymentMethod:
                  "RAZORPAY"
              }
            });

          }

          catch (error) {

            setIsVerifyingPayment(false);

            console.error(
              "Payment verification failed:",
              error
            );

            toast.error(
              error.response?.data?.error ||
              "Payment verification failed"
            );

          }

        },

        // Autofill customer details
        prefill: {
          name: user?.name || "",
          email: user?.email || ""
        },

        // Razorpay UI Theme
        theme: {
          color: "#2563eb"
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {

      console.error(
        "Razorpay Error:",
        error
      );

      toast.error(
        "Failed to start payment"
      );
    }
  };

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

    if (paymentMethod === PAYMENT_METHODS.RAZORPAY) {
      await handleRazorpayPayment();
      return;
    }

    const result = await Swal.fire({
      title: 'Confirm cash order?',
      html: `
        <div style="text-align:left">
          <p><b>${items.length} items</b></p>
          <p>Total: <b>${formatPrice(total)}</b></p>
          <p>Payment: <b>Cash on Counter</b></p>
          <br/>
          <p>Do you want to place this order?</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, place order',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#ef4444',
    });

    if (!result.isConfirmed) return;

    setIsPlacingOrder(true);

    try {
      const orderItems = items.map((item) => ({
        foodItemId: item.id,
        quantity: item.quantity,
      }));

      const response = await orderAPI.placeOrder({
        items: orderItems,
        paymentMethod,
      });

      const orderedItems = [...items];
      const orderedTotal = total;

      clearCart();
      toast.success('Order placed successfully!');

      navigate('/order-success', {
        state: {
          tokenNumber: response.data.order.token_number,
          total: orderedTotal,
          items: orderedItems,
          paymentMethod,
        },
      });
    } catch (error) {
      console.error('Failed to place order:', error);
      toast.error(error.response?.data?.error || 'Failed to place order');
    } finally {
      setIsPlacingOrder(false);
    }
  };



  if (isVerifyingPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">

        <div className="text-center">

          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>

          <h2 className="text-xl font-bold text-gray-800">
            Verifying Payment...
          </h2>

          <p className="text-gray-500 mt-2">
            Creating your order. Please wait.
          </p>

        </div>

      </div>
    );
  }

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
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl flex gap-4 shadow">
              <img
                src={item.image_url || 'https://via.placeholder.com/100'}
                alt={item.name}
                className="w-20 h-20 rounded object-cover"
              />

              <div className="flex-1">
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-blue-600 font-bold">{formatPrice(item.price)}</p>

                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, -1)}
                    className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    aria-label={`Decrease ${item.name} quantity`}
                  >
                    <Minus size={16} />
                  </button>

                  <span className="font-semibold">{item.quantity}</span>

                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, 1)}
                    className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    aria-label={`Increase ${item.name} quantity`}
                  >
                    <Plus size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="ml-auto text-red-500 hover:text-red-600"
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>

              <div className="font-bold text-lg">{formatPrice(item.price * item.quantity)}</div>
            </div>
          ))}
        </div>

        <aside className="bg-white p-6 rounded-xl shadow h-fit sticky top-24">
          <h2 className="text-xl font-bold mb-5">Order Summary</h2>

          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-gray-600">Total Amount</span>
            <span className="text-2xl font-bold text-blue-600">{formatPrice(total)}</span>
          </div>

          <div className="mt-5">
            <h3 className="font-semibold mb-3">Choose Payment Method</h3>

            <button
              type="button"
              onClick={() => setPaymentMethod(PAYMENT_METHODS.CASH)}
              className={`w-full border rounded-xl p-4 text-left transition mb-3 ${paymentMethod === PAYMENT_METHODS.CASH
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200'
                }`}
            >
              <div className="flex items-center gap-3">
                <Wallet
                  className={
                    paymentMethod === PAYMENT_METHODS.CASH ? 'text-blue-600' : 'text-gray-500'
                  }
                />
                <div>
                  <h4 className="font-semibold">Cash on Counter</h4>
                  <p className="text-sm text-gray-500">Pay when collecting your order</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod(PAYMENT_METHODS.RAZORPAY)}
              className={`w-full border rounded-xl p-4 text-left transition ${paymentMethod === PAYMENT_METHODS.RAZORPAY
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200'
                }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard
                  className={
                    paymentMethod === PAYMENT_METHODS.RAZORPAY
                      ? 'text-green-600'
                      : 'text-gray-500'
                  }
                />
                <div>
                  <h4 className="font-semibold">
                    Online Payment
                  </h4>
                  <p className="text-sm text-gray-500">
                    UPI, GPay, PhonePe, Paytm, Cards
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-5 p-3 rounded-lg bg-gray-100">
            <p className="text-sm text-gray-700">
              {paymentMethod === PAYMENT_METHODS.CASH
                ? '💵 Pay at the counter. Your order will start preparing after payment confirmation.'
                : '🔒 You will be redirected to secure Razorpay checkout. Pay using UPI, GPay, PhonePe, Paytm or cards.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder}
            className="btn-primary w-full mt-6"
          >
            {
              isPlacingOrder
                ? 'Processing...'
                : paymentMethod === PAYMENT_METHODS.CASH
                  ? 'Place Cash Order'
                  : 'Proceed to Pay'
            }
          </button>
        </aside>
      </div>
    </div>
  );

};

export default CartPage;
