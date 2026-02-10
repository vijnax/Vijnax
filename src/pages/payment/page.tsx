
import { useState, useEffect } from 'react';
import { paymentAPI } from '../../services/api';

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any;
    REACT_APP_NAVIGATE: any;
  }
}

export default function Payment() {
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      console.log('✅ Razorpay script loaded');
      setRazorpayLoaded(true);
    };
    script.onerror = () => {
      console.error('❌ Failed to load Razorpay script');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      alert('Payment gateway is loading. Please try again in a moment.');
      return;
    }

    setLoading(true);
    
    try {
      console.log('💳 Creating Razorpay order...');
      
      // Step 1: Create order on backend
      const orderResponse = await paymentAPI.createOrder(9900); // ₹99 = 9900 paise
      
      if (!orderResponse.success) {
        throw new Error(orderResponse.message || 'Failed to create order');
      }

      const { orderId, amount, currency, key } = orderResponse.data;
      console.log('✅ Order created:', orderId);

      // Step 2: Get user details from localStorage
      const userData = JSON.parse(localStorage.getItem('user') || '{}');

      // Step 3: Open Razorpay checkout
      const options = {
        key: key, // Razorpay key from backend
        amount: amount, // Amount in paise
        currency: currency,
        name: 'Career Compass',
        description: 'Psychometric Assessment Report',
        image: '/logo.png', // Your logo URL
        order_id: orderId,
        prefill: {
          name: userData.name || '',
          email: userData.email || '',
          contact: userData.mobile || ''
        },
        theme: {
          color: '#2563eb' // Blue color matching your theme
        },
        handler: async function (response: any) {
          console.log('✅ Payment successful:', response);
          
          // Step 4: Verify payment on backend
          try {
            const verifyResponse = await paymentAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              testId: sessionStorage.getItem('currentTestId')
            });

            if (verifyResponse.success) {
              console.log('✅ Payment verified');
              // Navigate to success page
              window.REACT_APP_NAVIGATE('/payment-success');
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (error) {
            console.error('❌ Payment verification error:', error);
            alert('Payment verification failed. Please contact support.');
          }
          
          setLoading(false);
        },
        modal: {
          ondismiss: function() {
            console.log('⚠️  Payment cancelled by user');
            setLoading(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      alert(error.message || 'Failed to process payment. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{fontFamily: "Pacifico, serif"}}>
            Career Compass
          </h1>
          <h2 className="text-2xl font-semibold text-gray-800">
            Unlock Your Personalized Report
          </h2>
          <p className="text-gray-600 mt-2">
            Get detailed insights about your personality, strengths, and career recommendations
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Price Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
            <div className="mb-4">
              <span className="text-4xl font-bold">₹99</span>
              <span className="text-blue-200 line-through ml-2">₹499</span>
            </div>
            <p className="text-blue-100 mb-4">Limited Time Offer - 80% Off!</p>
            <div className="bg-white/20 rounded-lg p-4">
              <h3 className="font-semibold mb-2">What you'll get:</h3>
              <ul className="text-sm space-y-1">
                <li>• Detailed Personality Analysis</li>
                <li>• Career Recommendations</li>
                <li>• Subject Selection Guide</li>
                <li>• Learning Style Assessment</li>
                <li>• Future Planning Roadmap</li>
              </ul>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="p-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Secure Payment</h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-blue-800 text-sm">
                <i className="ri-information-line mr-2"></i>
                Click the button below to proceed with secure payment. You can pay using UPI, Cards, Net Banking, or Wallets.
              </p>
            </div>

            {/* Payment Features */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="flex items-center space-x-2 text-gray-700">
                <i className="ri-bank-card-line text-blue-600 text-xl"></i>
                <span className="text-sm">Credit/Debit Cards</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700">
                <i className="ri-smartphone-line text-blue-600 text-xl"></i>
                <span className="text-sm">UPI Payment</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700">
                <i className="ri-wallet-line text-blue-600 text-xl"></i>
                <span className="text-sm">Wallets</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700">
                <i className="ri-bank-line text-blue-600 text-xl"></i>
                <span className="text-sm">Net Banking</span>
              </div>
            </div>

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={loading || !razorpayLoaded}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:transform-none whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              {!razorpayLoaded ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  Loading Payment Gateway...
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  Processing...
                </div>
              ) : (
                <>
                  <i className="ri-lock-line mr-2"></i>
                  Pay ₹99 Securely
                </>
              )}
            </button>

            {/* Security Note */}
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center text-green-800">
                <i className="ri-shield-check-line w-5 h-5 flex items-center justify-center mr-2"></i>
                <span className="font-semibold">Secure Payment</span>
              </div>
              <p className="text-green-700 text-sm mt-1">
                Your payment is secured with bank-level encryption. We don't store your payment details.
              </p>
            </div>

            {/* Powered by */}
            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm mb-2">Powered by</p>
              <div className="flex justify-center items-center">
                <svg className="w-24 h-8" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg">
                  <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#2563eb" fontSize="28" fontWeight="bold">Razorpay</text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Money Back Guarantee */}
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-lg text-center">
          <i className="ri-refund-2-line w-12 h-12 flex items-center justify-center text-green-600 mx-auto mb-3 text-3xl"></i>
          <h3 className="font-semibold text-gray-900 mb-2">100% Money Back Guarantee</h3>
          <p className="text-gray-600 text-sm">
            Not satisfied with your report? Get a full refund within 7 days, no questions asked.
          </p>
        </div>
      </div>
    </div>
  );
}
