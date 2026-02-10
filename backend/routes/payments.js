import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Test from '../models/Test.js';

const router = express.Router();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Test amount (in paise - 1 INR = 100 paise)
const TEST_AMOUNT = 9900; // ₹99

// @route   POST /api/payments/create-order
// @desc    Create Razorpay order for test payment
// @access  Private
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { amount = TEST_AMOUNT, currency = 'INR', testId } = req.body;

    // Create order options
    const options = {
      amount: amount, // Amount in paise (₹99 = 9900 paise)
      currency: currency,
      receipt: `test_${testId || Date.now()}`,
      notes: {
        userId: req.user.id,
        testId: testId || 'new_test',
        purpose: 'Career Compass Assessment'
      }
    };

    console.log(`💳 Creating Razorpay order for user ${req.user.id}:`, options);

    // Create order
    const order = await razorpay.orders.create(options);

    console.log(`✅ Razorpay order created: ${order.id}`);

    res.json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID // Send key to frontend for checkout
      }
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment signature
// @access  Private
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      testId 
    } = req.body;

    console.log(`🔐 Verifying payment for order: ${razorpay_order_id}`);

    // Generate signature for verification
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Verify signature
    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Payment verification failed: Invalid signature');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    console.log(`✅ Payment verified successfully: ${razorpay_payment_id}`);

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    // Update user payment history
    const user = await User.findById(req.user.id);
    if (user) {
      user.paymentHistory.push({
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: payment.amount / 100, // Convert paise to rupees
        currency: payment.currency,
        status: 'completed',
        method: payment.method,
        testId: testId || null,
        date: new Date()
      });
      await user.save();
      console.log(`✅ Payment history updated for user: ${user.email}`);
    }

    // If testId provided, update test metadata
    if (testId) {
      await Test.findByIdAndUpdate(testId, {
        'metadata.paymentId': razorpay_payment_id,
        'metadata.paymentStatus': 'completed',
        'metadata.paidAmount': payment.amount / 100
      });
      console.log(`✅ Test metadata updated for testId: ${testId}`);
    }

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      }
    });

  } catch (error) {
    console.error('❌ Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
});

// @route   GET /api/payments/status/:paymentId
// @desc    Get payment status
// @access  Private
router.get('/status/:paymentId', verifyToken, async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(paymentId);

    res.json({
      success: true,
      data: {
        id: payment.id,
        amount: payment.amount / 100, // Convert paise to rupees
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        createdAt: new Date(payment.created_at * 1000)
      }
    });

  } catch (error) {
    console.error('❌ Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message
    });
  }
});

// @route   GET /api/payments/history
// @desc    Get user's payment history
// @access  Private
router.get('/history', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('paymentHistory');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        payments: user.paymentHistory || []
      }
    });

  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment history',
      error: error.message
    });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle Razorpay webhook events
// @access  Public (but verified with signature)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret) {
      const generatedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (generatedSignature !== webhookSignature) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📬 Razorpay webhook received: ${event}`);

    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        console.log(`✅ Payment captured: ${payload.payment.entity.id}`);
        // Handle successful payment
        break;
      
      case 'payment.failed':
        console.log(`❌ Payment failed: ${payload.payment.entity.id}`);
        // Handle failed payment
        break;
      
      default:
        console.log(`ℹ️  Unhandled webhook event: ${event}`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

export default router;

