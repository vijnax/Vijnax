# Razorpay Payment Integration Guide

## Overview

The Career Compass platform now has a fully integrated Razorpay payment gateway for processing test report payments. Users can pay ₹99 to access their detailed psychometric assessment report.

## Features Implemented

### Backend (`/backend/routes/payments.js`)

1. **Create Order Endpoint** (`POST /api/payments/create-order`)
   - Creates a new Razorpay order
   - Returns order ID and Razorpay key to frontend
   - Amount: ₹99 (9900 paise)

2. **Verify Payment Endpoint** (`POST /api/payments/verify`)
   - Verifies Razorpay payment signature
   - Updates user payment history
   - Links payment to test results

3. **Payment Status Endpoint** (`GET /api/payments/status/:paymentId`)
   - Fetches payment details from Razorpay
   - Returns payment status and details

4. **Payment History Endpoint** (`GET /api/payments/history`)
   - Returns user's complete payment history

5. **Webhook Endpoint** (`POST /api/payments/webhook`)
   - Handles Razorpay webhook events
   - Processes payment.captured and payment.failed events

### Frontend (`/src/pages/payment/page.tsx`)

1. **Razorpay Checkout Integration**
   - Dynamically loads Razorpay script
   - Opens Razorpay checkout modal
   - Supports all payment methods (UPI, Cards, Net Banking, Wallets)

2. **Payment Flow**
   - User clicks "Pay ₹99 Securely" button
   - Backend creates Razorpay order
   - Frontend opens Razorpay checkout
   - User completes payment
   - Backend verifies payment signature
   - User redirected to success page

### API Methods (`/src/services/api.js`)

```javascript
paymentAPI.createOrder(amount, testId)     // Create Razorpay order
paymentAPI.verifyPayment(paymentData)      // Verify payment
paymentAPI.getPaymentStatus(paymentId)     // Get payment status
paymentAPI.getPaymentHistory()             // Get user payment history
```

## Environment Variables

Add these to your `.env` file:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_SELMMV2a58s64K
RAZORPAY_KEY_SECRET=8uJqxxzPBtM8Gh9dUt90GDMf
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_razorpay
```

## Database Schema Updates

### User Model - Payment History

```javascript
paymentHistory: [{
  paymentId: String,        // Razorpay payment ID
  orderId: String,          // Razorpay order ID
  amount: Number,           // Amount in INR
  currency: String,         // Default: 'INR'
  status: String,           // completed, pending, failed, refunded
  method: String,           // Payment method used
  testId: ObjectId,         // Reference to Test
  date: Date                // Payment date
}]
```

## Testing the Integration

### Test Mode (Current Setup)

You're currently using Razorpay test keys:
- Key ID: `rzp_test_SELMMV2a58s64K`
- Key Secret: `8uJqxxzPBtM8Gh9dUt90GDMf`

### Test Cards for Razorpay

Use these test cards in test mode:

**Success Card:**
- Card Number: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date

**UPI Test:**
- UPI ID: `success@razorpay`

### Testing Steps

1. Go to payment page: `http://localhost:5173/payment`
2. Click "Pay ₹99 Securely"
3. Use test card details
4. Complete payment
5. Check backend logs for verification
6. Check MongoDB for payment history update

## Production Deployment

### Step 1: Get Production Keys

1. Login to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Complete KYC verification
3. Get production keys:
   - Settings → API Keys → Generate Live Keys
   - Replace `rzp_test_xxx` with `rzp_live_xxx`

### Step 2: Update Environment Variables on Render

```bash
RAZORPAY_KEY_ID=rzp_live_your_production_key
RAZORPAY_KEY_SECRET=your_production_secret
```

### Step 3: Set Up Webhooks (Optional)

1. Go to Razorpay Dashboard → Settings → Webhooks
2. Add webhook URL: `https://vijnax.onrender.com/api/payments/webhook`
3. Select events:
   - `payment.captured`
   - `payment.failed`
4. Copy webhook secret and add to environment:
   ```bash
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ```

## Payment Flow Diagram

```
User → Frontend Payment Page
         ↓
Frontend → Backend: Create Order Request
         ↓
Backend → Razorpay API: Create Order
         ↓
Razorpay → Backend: Order ID + Details
         ↓
Backend → Frontend: Order ID + Razorpay Key
         ↓
Frontend: Opens Razorpay Checkout Modal
         ↓
User: Completes Payment
         ↓
Razorpay → Frontend: Payment Response
         ↓
Frontend → Backend: Verify Payment
         ↓
Backend: Validates Signature
         ↓
Backend: Updates User Payment History
         ↓
Backend → Frontend: Verification Success
         ↓
Frontend: Redirects to Success Page
```

## Security Features

1. **Signature Verification**
   - All payments verified using HMAC SHA256 signature
   - Prevents payment tampering

2. **JWT Authentication**
   - All payment endpoints require valid JWT token
   - Ensures only authenticated users can make payments

3. **Amount Validation**
   - Backend validates payment amounts
   - Frontend cannot manipulate prices

4. **Webhook Signature**
   - Webhooks verified with secret key
   - Prevents fake webhook calls

## Error Handling

The integration handles these scenarios:

1. **Order Creation Failure**
   - Shows user-friendly error message
   - Logs detailed error on backend

2. **Payment Cancellation**
   - Allows user to retry
   - No charge on cancellation

3. **Verification Failure**
   - Shows error and support contact
   - Logs transaction details for investigation

4. **Network Issues**
   - Automatic retry mechanism
   - Shows loading states

## Console Logs for Debugging

Backend logs payment flow:

```
💳 Creating Razorpay order for user [userId]
✅ Razorpay order created: [orderId]
🔐 Verifying payment for order: [orderId]
✅ Payment verified successfully: [paymentId]
✅ Payment history updated for user: [email]
```

Frontend logs:

```
✅ Razorpay script loaded
💳 Creating Razorpay order...
✅ Order created: [orderId]
✅ Payment successful: [response]
✅ Payment verified
```

## Common Issues & Solutions

### Issue 1: "Payment gateway is loading"

**Solution:** Ensure Razorpay script loads properly. Check network tab for script errors.

### Issue 2: Signature verification fails

**Solution:** Verify `RAZORPAY_KEY_SECRET` is correct in `.env` file.

### Issue 3: Payment successful but not verified

**Solution:** Check backend logs. Ensure `/api/payments/verify` endpoint is accessible.

### Issue 4: Amount mismatch

**Solution:** Remember Razorpay uses paise (1 INR = 100 paise). ₹99 = 9900 paise.

## Next Steps

1. ✅ **Test the payment flow locally**
   - Use test cards
   - Verify payment history updates

2. ✅ **Deploy to production**
   - Update environment variables on Render
   - Test with real test cards

3. 🔄 **Get production keys** (when ready)
   - Complete Razorpay KYC
   - Switch to live keys

4. 🔄 **Set up webhooks** (optional)
   - Configure webhook URL
   - Handle webhook events

5. 🔄 **Add refund functionality** (future)
   - Implement refund API
   - Add admin panel for refunds

## Support

For issues or questions:
- Check Razorpay docs: https://razorpay.com/docs/
- Check backend logs on Render
- Test in test mode first before going live

---

**Status:** ✅ FULLY IMPLEMENTED AND READY TO TEST

**Test Amount:** ₹99 (9900 paise)

**Payment Methods:** All (UPI, Cards, Net Banking, Wallets)
