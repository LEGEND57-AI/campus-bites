import crypto from "crypto";
import { supabase } from "../db.js";
import express from "express";
import { razorpay } from "../utils/razorpay.js";
import { authenticate } from "../middleware/auth.js";
import { generateDailyToken } from "../utils/tokenGenerator.js";

const router = express.Router();


// Protected route
router.use(authenticate);


// Create Razorpay Order
router.post("/create-order", async (req, res) => {

    try {

        const { amount } = req.body;


        // Validation
        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: "Invalid amount"
            });
        }


        const options = {

            // Razorpay uses paise
            amount: Math.round(amount * 100),

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


        // Payment is genuine
        console.log(
            "Payment verified successfully"
        );


        // Next:
        // Calculate food price
        // Create order

        // Validate items
        if (!items || items.length === 0) {
            return res.status(400).json({
                error: "No items received"
            });
        }


        // Get latest food prices
        const itemIds = items.map(item => item.foodItemId);


        const { data: foodItems, error: fetchError } =
            await supabase
                .from("food_items")
                .select("id, price, name")
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


            totalAmount += foodItem.price * item.quantity;


            return {
                food_item_id: item.foodItemId,
                quantity: item.quantity,
                price_at_time: foodItem.price
            };

        });

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