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
        const itemsWithServerPrice = [];

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

            itemsWithServerPrice.push({
                foodItemId: item.foodItemId,
                quantity: item.quantity,
                price: foodItem.price
            });
        }


        const options = {

            // Razorpay uses paise
            amount: Math.round(totalAmount * 100),

            currency: "INR",

            receipt: `receipt_${Date.now()}`,

            payment_capture: 1,

            // Lets the webhook (routes/paymentWebhook.js) identify which
            // user a payment belongs to if /verify never runs (e.g. the
            // browser closes after payment but before the callback fires).
            // Only the user id is stored here, not the cart, to stay well
            // under Razorpay's per-note size limit.
            notes: {
                user_id: String(req.user.id),
            },

        };


        const order = await razorpay.orders.create(options);

        // Persist the payment intent BEFORE sending the Razorpay order
        // back to the client. This gives the webhook a reliable server-side
        // record of the cart and amount if /verify is never called.
        const { error: intentError } = await supabase
            .from("payment_intents")
            .insert([
                {
                    user_id: req.user.id,
                    razorpay_order_id: order.id,
                    items: itemsWithServerPrice,
                    total_amount: totalAmount,
                    status: "CREATED"
                }
            ]);

        if (intentError) {
            // Do not expose database details to the client.
            console.error(
                "Payment intent creation error:",
                intentError
            );

            return res.status(500).json({
                error: "Failed to initialize payment"
            });
        }

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

    // Set once the payment_intents row has been atomically claimed
    // (CREATED -> PAID) below. Used by the catch block and by the
    // amount-mismatch path to know whether the claim needs to be
    // reverted so a legitimate retry can proceed.
    let claimedIntent = null;

    // Set once the `orders` row has actually been inserted. Once true,
    // the claim must never be reverted to CREATED — that could let a
    // retry attempt a second order creation.
    let orderCreated = false;

    async function revertIntentClaim() {
        if (!claimedIntent) return;

        try {
            const { error: revertError } = await supabase
                .from("payment_intents")
                .update({ status: "CREATED" })
                .eq("id", claimedIntent.id)
                .eq("status", "PAID");

            if (revertError) {
                console.error(
                    "Failed to revert payment_intents claim after verification failure.",
                    { intentId: claimedIntent.id, revertError }
                );
            }
        } catch (revertCatchError) {
            console.error(
                "Unexpected error while reverting payment_intents claim.",
                { intentId: claimedIntent.id, revertCatchError }
            );
        }
    }

    try {

        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
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


        if (typeof razorpay_signature !== "string") {

            return res.status(400).json({

                error: "Payment verification failed"

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


        // Compare signatures using a constant-time comparison to avoid
        // leaking timing information about the expected signature.
        const providedSignatureBuffer = Buffer.from(razorpay_signature, "utf8");
        const generatedSignatureBuffer = Buffer.from(generatedSignature, "utf8");

        const signatureValid =
            providedSignatureBuffer.length === generatedSignatureBuffer.length &&
            crypto.timingSafeEqual(providedSignatureBuffer, generatedSignatureBuffer);

        if (!signatureValid) {

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

        // Fetch the server-side payment intent recorded at /create-order
        // time. This is the sole source of truth for what was actually
        // paid for — items are never trusted from req.body here.
        const { data: intent, error: intentFetchError } = await supabase
            .from("payment_intents")
            .select("*")
            .eq("razorpay_order_id", razorpay_order_id)
            .maybeSingle();

        if (intentFetchError) throw intentFetchError;

        if (!intent || intent.user_id !== req.user.id) {
            return res.status(400).json({
                error: "Payment intent not found"
            });
        }

        // Atomically claim the intent so concurrent /verify calls for the
        // same order cannot both proceed past this point.
        const { data: claimResult, error: claimError } = await supabase
            .from("payment_intents")
            .update({ status: "PAID" })
            .eq("id", intent.id)
            .eq("status", "CREATED")
            .select()
            .maybeSingle();

        if (claimError) throw claimError;

        if (!claimResult) {
            return res.status(400).json({
                error: "Payment already verified or in progress"
            });
        }

        claimedIntent = claimResult;

        // Re-check current availability for the items recorded on the
        // intent (stock can change between /create-order and /verify).
        const itemIds = claimedIntent.items.map(item => item.foodItemId);

        const { data: foodItems, error: fetchError } =
            await supabase
                .from("food_items")
                .select("id, price, name, available")
                .in("id", itemIds);

        if (fetchError) throw fetchError;

        // Prepare order items from the intent, not req.body
        const orderItemsWithPrices = claimedIntent.items.map(item => {

            const foodItem = foodItems.find(
                fi => fi.id === item.foodItemId
            );

            if (!foodItem) {
                throw new Error("Food item not found");
            }

            if (!foodItem.available) {
                throw new Error(`${foodItem.name} is currently unavailable`);
            }

            if (typeof item.price !== "number") {
                throw new Error("Payment intent is missing a pinned price for an item");
            }

            return {
                food_item_id: item.foodItemId,
                quantity: item.quantity,
                price_at_time: item.price
            };

        });

        // Verify the captured payment amount matches the amount the
        // intent was created with (the amount Razorpay was actually
        // told to charge), not a live recompute from current prices.
        if (payment.amount !== Math.round(claimedIntent.total_amount * 100)) {
            await revertIntentClaim();

            return res.status(400).json({
                error: "Payment amount mismatch"
            });
        }

        // Generate daily token
        const {
            token_number,
            token_date
        } = await generateDailyToken();

        // Create the order and its order_items atomically in one
        // transaction via the create_order_with_items RPC — either both
        // are committed together or neither is. This removes the
        // possibility of an order existing with zero items.
        const { data: order, error: orderError } = await supabase.rpc(
            "create_order_with_items",
            {
                p_user_id: req.user.id,
                p_total_amount: claimedIntent.total_amount,
                p_token_number: token_number,
                p_token_date: token_date,
                // Store Razorpay payment details
                p_payment_id: razorpay_payment_id,
                p_payment_time: new Date().toISOString(),
                p_items: orderItemsWithPrices
            }
        );

        if (orderError) throw orderError;

        // From this point on the order row (with its items) exists and
        // is uniquely tied to this payment_id — the claim must never be
        // reverted, or a retry could attempt (and collide on, or worse
        // duplicate) a second order for the same payment.
        orderCreated = true;

        // Order and order_items both exist. Finalize the intent before
        // the notification step so the intent's lifecycle never depends
        // on notification delivery succeeding.
        const { error: finalizeError } = await supabase
            .from("payment_intents")
            .update({
                order_id: order.id,
                status: "ORDER_CREATED",
                razorpay_payment_id
            })
            .eq("id", claimedIntent.id);

        if (finalizeError) {
            // The order is genuinely valid at this point — the customer
            // must not be told verification failed. Attempt reconciliation
            // instead of just leaving the intent stuck on PAID.
            console.error(
                "payment_intents finalize failed after order was fully " +
                "created — attempting reconciliation.",
                { orderId: order.id, intentId: claimedIntent.id, finalizeError }
            );

            const { data: confirmedOrder } = await supabase
                .from("orders")
                .select("id")
                .eq("payment_id", razorpay_payment_id)
                .maybeSingle();

            if (confirmedOrder) {
                const { error: retryFinalizeError } = await supabase
                    .from("payment_intents")
                    .update({
                        order_id: confirmedOrder.id,
                        status: "ORDER_CREATED",
                        razorpay_payment_id
                    })
                    .eq("id", claimedIntent.id);

                if (retryFinalizeError) {
                    console.error(
                        "payment_intents reconciliation retry also " +
                        "failed — needs manual reconciliation.",
                        { orderId: confirmedOrder.id, intentId: claimedIntent.id, retryFinalizeError }
                    );
                }
            } else {
                console.error(
                    "payment_intents finalize failed and order could " +
                    "not be re-confirmed by payment_id — needs urgent " +
                    "manual reconciliation.",
                    { orderId: order.id, intentId: claimedIntent.id, razorpay_payment_id }
                );
            }
            // Fall through to the success response below regardless —
            // the order was created successfully.
        }

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

        if (!orderCreated) {
            await revertIntentClaim();
        }

        res.status(500).json({

            error: "Payment verification failed"

        });

    }

});


export default router;