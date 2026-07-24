import crypto from "crypto";
import { supabase } from "../db.js";
import express from "express";
import { razorpay } from "../utils/razorpay.js";
import { authenticate } from "../middleware/auth.js";
import { generateDailyToken } from "../utils/tokenGenerator.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";
import { createNotification } from "../utils/notificationService.js";

const router = express.Router();
router.use(paymentLimiter);


// Protected route
router.use(authenticate);


// Create Razorpay Order
router.post("/create-order", async (req, res) => {

    try {

        const { items } = req.body;


        // Validation
        if (!items || items.length === 0) {
            return res.status(400).json({
                error: "Cart is empty"
            });
        }

        // Maximum items validation
        if (items.length > 10) {
            return res.status(400).json({
                error: "Maximum 10 items allowed in one order."
            });
        }

        // Validate each item
        for (const item of items) {
            if (
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 20
            ) {
                return res.status(400).json({
                    error: "Invalid quantity."
                });
            }

            if (!Number.isInteger(item.foodItemId)) {
                return res.status(400).json({
                    error: "Invalid food item."
                });
            }
        }

        // Duplicate validation
        const uniqueItems = new Set();

        for (const item of items) {
            if (uniqueItems.has(item.foodItemId)) {
                return res.status(400).json({
                    error: "Duplicate food items are not allowed."
                });
            }

            uniqueItems.add(item.foodItemId);
        }

        // Get latest food prices
        const itemIds = items.map(item => item.foodItemId);

        const { data: foodItems, error: fetchError } = await supabase
            .from("food_items")
            .select("id, price, name, available")
            .in("id", itemIds);

        if (fetchError) throw fetchError;

        let totalAmount = 0;

        for (const item of items) {

            const foodItem = foodItems.find(
                fi => fi.id === item.foodItemId
            );

            if (!foodItem) {
                throw new Error("Food item not found");
            }

            if (!foodItem.available) {
                throw new Error(`${foodItem.name} is currently unavailable`);
            }

            totalAmount += foodItem.price * item.quantity;
        }


        const options = {

            // Razorpay uses paise
            amount: Math.round(totalAmount * 100),

            currency: "INR",

            receipt: `receipt_${Date.now()}`,

            payment_capture: 1

        };


        const order = await razorpay.orders.create(options);


        res.json({

            success: true,

            key: process.env.RAZORPAY_KEY_ID,

            order

        });


    } catch (error) {


        console.error(
            "Razorpay create order error:",
            error
        );


        res.status(500).json({

            error: "Failed to create payment order"

        });

    }

});

// Verify Razorpay Payment
router.post("/verify", async (req, res) => {

    try {

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            items
        } = req.body;


        // Validate required data
        if (
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {

            return res.status(400).json({
                error: "Payment data missing"
            });

        }


        // Create expected signature
        const generatedSignature =
            crypto
                .createHmac(
                    "sha256",
                    process.env.RAZORPAY_KEY_SECRET
                )
                .update(
                    razorpay_order_id +
                    "|" +
                    razorpay_payment_id
                )
                .digest("hex");


        // Compare signatures
        if (generatedSignature !== razorpay_signature) {

            return res.status(400).json({

                error: "Payment verification failed"

            });

        }

        // Check if this payment was already used
        const { data: existingOrder } = await supabase
            .from("orders")
            .select("id")
            .eq("payment_id", razorpay_payment_id)
            .maybeSingle();

        if (existingOrder) {
            return res.status(400).json({
                error: "Order already created for this payment"
            });
        }

        // Fetch payment from Razorpay
        const payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        // Verify payment is captured
        if (payment.status !== "captured") {
            return res.status(400).json({
                error: "Payment not captured"
            });
        }

        console.log("Payment verified successfully");

        // Create order

        // Validate items
        if (!items || items.length === 0) {
            return res.status(400).json({
                error: "No items received"
            });
        }

        // Maximum items validation
        if (items.length > 10) {
            return res.status(400).json({
                error: "Maximum 10 items allowed in one order."
            });
        }

        // Validate each item
        for (const item of items) {
            if (
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                item.quantity > 20
            ) {
                return res.status(400).json({
                    error: "Invalid quantity."
                });
            }

            if (!Number.isInteger(item.foodItemId)) {
                return res.status(400).json({
                    error: "Invalid food item."
                });
            }
        }

        // Duplicate validation
        const uniqueItems = new Set();

        for (const item of items) {
            if (uniqueItems.has(item.foodItemId)) {
                return res.status(400).json({
                    error: "Duplicate food items are not allowed."
                });
            }

            uniqueItems.add(item.foodItemId);
        }


        // Get latest food prices
        const itemIds = items.map(item => item.foodItemId);


        const { data: foodItems, error: fetchError } =
            await supabase
                .from("food_items")
                .select("id, price, name, available")
                .in("id", itemIds);


        if (fetchError) throw fetchError;


        let totalAmount = 0;


        // Prepare order items
        const orderItemsWithPrices = items.map(item => {

            const foodItem = foodItems.find(
                fi => fi.id === item.foodItemId
            );

            if (!foodItem) {
                throw new Error("Food item not found");
            }

            // ✅ YE 4 LINES YAHAN ADD KARNI HAI
            if (!foodItem.available) {
                throw new Error(`${foodItem.name} is currently unavailable`);
            }

            totalAmount += foodItem.price * item.quantity;

            return {
                food_item_id: item.foodItemId,
                quantity: item.quantity,
                price_at_time: foodItem.price
            };

        });

        // Verify payment amount matches calculated amount
        if (payment.amount !== Math.round(totalAmount * 100)) {
            return res.status(400).json({
                error: "Payment amount mismatch"
            });
        }

        // Generate daily token
        const {
            token_number,
            token_date
        } = await generateDailyToken();

        // Create RAZORPAY order
        const { data: order, error: orderError } =
            await supabase
                .from("orders")
                .insert([
                    {
                        user_id: req.user.id,
                        total_amount: totalAmount,
                        status: "Pending",
                        payment_method: "RAZORPAY",
                        payment_status: "PAID",
                        token_number,
                        token_date,
                        // Store Razorpay payment details
                        payment_id: razorpay_payment_id,
                        payment_time: new Date().toISOString()
                    }
                ])
                .select()
                .single();

        if (orderError) throw orderError;


        // Add items with order ID
        const orderItemsWithOrderId =
            orderItemsWithPrices.map(item => ({
                ...item,
                order_id: order.id
            }));


        const { error: itemsError } =
            await supabase
                .from("order_items")
                .insert(orderItemsWithOrderId);


        if (itemsError) throw itemsError;

        await createNotification({
            userId: req.user.id,
            title: "Order Placed",
            message: `Your order has been placed successfully.`,
            type: "order_placed",
            orderId: order.id,
            tokenNumber: token_number,
            actionUrl: `/track-order/${order.id}`,
        });


        // Success response
        res.status(201).json({

            success: true,

            message: "Payment verified and order created",

            order

        });


    } catch (error) {


        console.error(
            "Razorpay verification error:",
            error
        );


        res.status(500).json({

            error: "Payment verification failed"

        });

    }

});


export default router;