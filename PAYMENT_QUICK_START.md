# 💳 Payment Gateway - Quick Start Guide

## ✅ Razorpay Integration Ready!

Your Razorpay payment gateway is **fully implemented and ready to test**!

---

## 🚀 Quick Test (5 minutes)

### Step 1: Start Backend (Terminal 1)

```bash
cd /Users/animesh/Documents/BoostMySites/Vijnax/backend
npm start
```

**Expected output:**
```
🚀 Career Compass API server running on port 5001
🗄️  MongoDB connected
```

### Step 2: Start Frontend (Terminal 2)

```bash
cd /Users/animesh/Documents/BoostMySites/Vijnax
npm run dev
```

**Expected output:**
```
Local: http://localhost:5173
```

### Step 3: Test Razorpay Connection (Terminal 3)

```bash
cd /Users/animesh/Documents/BoostMySites/Vijnax
node backend/scripts/test_razorpay.js
```

**Expected output:**
```
✅ Order created successfully!
✅ All tests passed!
```

### Step 4: Test Payment Flow

1. **Open browser:** `http://localhost:5173/payment`

2. **Click:** "Pay ₹99 Securely" button

3. **Use test card:**
   - Card: `4111 1111 1111 1111`
   - CVV: `123`
   - Expiry: `12/25` (any future date)
   - Name: Your Name

4. **Complete payment**

5. **Success!** You should be redirected to success page

---

## 🧪 Test Credentials

### Test Card (Success)
```
Card Number: 4111 1111 1111 1111
CVV: 123
Expiry: 12/25
Name: Test User
```

### Test UPI
```
UPI ID: success@razorpay
```

### Test Net Banking
```
Bank: Any bank (will auto-succeed in test mode)
```

---

## 📊 Verify Payment

### Check Backend Logs

You should see:
```
💳 Creating Razorpay order for user...
✅ Razorpay order created: order_xxxxx
🔐 Verifying payment for order: order_xxxxx
✅ Payment verified successfully: pay_xxxxx
✅ Payment history updated for user
```

### Check MongoDB

Connect to your MongoDB and run:
```javascript
db.users.findOne(
  { email: "your_test_user@email.com" },
  { paymentHistory: 1 }
)
```

You should see a new payment record!

---

## 🎯 Current Configuration

**Environment:** Test Mode  
**Amount:** ₹99  
**Payment Methods:** All (UPI, Cards, Net Banking, Wallets)  
**Keys:** Test keys (see `.env` file)

---

## ⚠️ Important Notes

1. **Test Mode:** You're using Razorpay **TEST** keys
2. **No Real Money:** All transactions are fake in test mode
3. **Test Cards Only:** Use Razorpay test cards for testing
4. **Production:** Switch to live keys when going production

---

## 🔄 Quick Deploy to Render

Already configured! Just push to GitHub:

```bash
git add .
git commit -m "Add Razorpay payment gateway"
git push origin main
```

Render will auto-deploy with your test keys!

---

## 📱 Payment Features

✅ UPI Payment (Google Pay, PhonePe, Paytm)  
✅ Credit/Debit Cards (Visa, Mastercard, RuPay)  
✅ Net Banking (All major banks)  
✅ Wallets (Paytm, Mobikwik, etc.)  
✅ EMI Options (for eligible cards)  
✅ International Cards (Visa, Mastercard)

---

## 💰 Pricing

**Test Amount:** ₹99  
**Original Price:** ₹499  
**Discount:** 80% OFF

---

## 🐛 Quick Troubleshooting

### "Payment gateway is loading" stuck
- Check if Razorpay script loaded (F12 → Network tab)
- Refresh page and try again

### Payment verification fails
- Check backend logs
- Verify `.env` has correct `RAZORPAY_KEY_SECRET`

### Modal doesn't open
- Check browser console for errors
- Ensure Razorpay script loaded properly

### Backend error
- Verify MongoDB is connected
- Check environment variables are set

---

## 📞 Need Help?

1. Check backend logs in terminal
2. Check browser console (F12)
3. Check MongoDB connection
4. Refer to `RAZORPAY_PAYMENT_INTEGRATION.md` for detailed guide

---

## ✨ What's Implemented

✅ **Backend:**
- Order creation endpoint
- Payment verification endpoint
- Payment history endpoint
- Webhook handler

✅ **Frontend:**
- Razorpay checkout integration
- Payment success/failure handling
- Loading states
- Error handling

✅ **Database:**
- Payment history in User model
- Payment metadata in Test model

✅ **Security:**
- JWT authentication
- Signature verification
- Webhook validation

---

## 🎉 Ready to Test!

Everything is set up and ready. Follow the 4 steps above to test your payment integration!

**Time to first test:** 5 minutes  
**Status:** ✅ READY
