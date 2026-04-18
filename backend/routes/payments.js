import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import Test from '../models/Test.js';

const router = express.Router();

/** Lazily create Razorpay so the server can boot without payment keys (local dev). */
let razorpaySingleton = null;
let razorpayUnavailableLogged = false;
function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    if (!razorpayUnavailableLogged) {
      razorpayUnavailableLogged = true;
      console.warn('⚠️  Razorpay disabled: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable payments.');
    }
    return null;
  }
  if (!razorpaySingleton) {
    razorpaySingleton = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpaySingleton;
}

function paymentsNotConfigured(res) {
  return res.status(503).json({
    success: false,
    message: 'Payment service is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.'
  });
}

// Test amount (in paise - 1 INR = 100 paise)
const TEST_AMOUNT = 9900; // ₹99

// @route   POST /api/payments/create-order
// @desc    Create Razorpay order for test payment
// @access  Private
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) return paymentsNotConfigured(res);

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
    const razorpay = getRazorpay();
    if (!razorpay) return paymentsNotConfigured(res);

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
    // Find user by mobile or email if ID is not a valid ObjectId
    let user;
    if (req.user.id && req.user.id.match(/^[0-9a-fA-F]{24}$/)) {
      // Valid MongoDB ObjectId
      user = await User.findById(req.user.id);
    } else if (req.user.mobile) {
      // Find by mobile number
      user = await User.findOne({ mobile: req.user.mobile });
    } else if (req.user.email) {
      // Find by email
      user = await User.findOne({ email: req.user.email });
    }

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
      console.log(`✅ Payment history updated for user: ${user.email || user.mobile}`);
    } else {
      console.warn(`⚠️  User not found for payment. User ID: ${req.user.id}, Mobile: ${req.user.mobile}`);
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
    const razorpay = getRazorpay();
    if (!razorpay) return paymentsNotConfigured(res);

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
// @access  Public (verified with HMAC signature)
router.post('/webhook', async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured — rejecting webhook');
      return res.status(500).json({ success: false, message: 'Webhook not configured' });
    }

    if (!webhookSignature) {
      return res.status(400).json({ success: false, message: 'Missing x-razorpay-signature header' });
    }

    // req.rawBody is set by the verify callback in express.json() (see server.js)
    if (!req.rawBody) {
      console.error('Raw body not available — verify callback may be misconfigured');
      return res.status(500).json({ success: false, message: 'Raw body not captured' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(webhookSignature, 'hex'))) {
      console.error('Webhook signature mismatch — rejecting');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const { event, payload } = req.body;
    console.log(`Razorpay webhook received: ${event}`);

    switch (event) {
      case 'payment.captured': {
        const payment = payload.payment.entity;
        const paymentId = payment.id;
        const orderId = payment.order_id;
        const userId = payment.notes?.userId;
        const testId = payment.notes?.testId;

        // Idempotency: skip if this payment was already recorded
        const alreadyRecorded = await User.findOne({ 'paymentHistory.paymentId': paymentId });
        if (alreadyRecorded) {
          console.log(`Payment ${paymentId} already processed — skipping`);
          return res.json({ success: true });
        }

        if (userId) {
          const user = await User.findById(userId);
          if (user) {
            user.paymentHistory.push({
              paymentId,
              orderId,
              amount: payment.amount / 100,
              currency: payment.currency,
              status: 'completed',
              method: payment.method,
              testId: testId && testId !== 'new_test' ? testId : null,
              date: new Date()
            });
            await user.save();
            console.log(`Webhook: payment ${paymentId} recorded for user ${userId}`);
          } else {
            console.warn(`Webhook: user ${userId} not found for payment ${paymentId}`);
          }
        }

        if (testId && testId !== 'new_test') {
          await Test.findByIdAndUpdate(testId, {
            'metadata.paymentId': paymentId,
            'metadata.paymentStatus': 'completed',
            'metadata.paidAmount': payment.amount / 100
          });
          console.log(`Webhook: test ${testId} marked as paid`);
        }

        break;
      }

      case 'payment.failed': {
        const failedPayment = payload.payment.entity;
        const userId = failedPayment.notes?.userId;
        const testId = failedPayment.notes?.testId;

        console.log(`Payment failed: ${failedPayment.id}, reason: ${failedPayment.error_description || 'unknown'}`);

        if (userId) {
          const user = await User.findById(userId);
          if (user) {
            user.paymentHistory.push({
              paymentId: failedPayment.id,
              orderId: failedPayment.order_id,
              amount: failedPayment.amount / 100,
              currency: failedPayment.currency,
              status: 'failed',
              method: failedPayment.method || 'unknown',
              testId: testId && testId !== 'new_test' ? testId : null,
              date: new Date()
            });
            await user.save();
          }
        }

        if (testId && testId !== 'new_test') {
          await Test.findByIdAndUpdate(testId, {
            'metadata.paymentStatus': 'failed'
          });
        }

        break;
      }

      case 'order.paid': {
        console.log(`Order paid: ${payload.order.entity.id}`);
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

export default router;

