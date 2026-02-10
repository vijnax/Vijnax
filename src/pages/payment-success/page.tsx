
import { useState, useEffect } from 'react';
import { reportAPI } from '../../services/api';

export default function PaymentSuccess() {
  const [downloading, setDownloading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [testId, setTestId] = useState(null);

  useEffect(() => {
    // Get payment info from sessionStorage
    const storedPaymentInfo = sessionStorage.getItem('paymentInfo');
    const storedTestId = sessionStorage.getItem('currentTestId');
    
    if (storedPaymentInfo) {
      setPaymentInfo(JSON.parse(storedPaymentInfo));
    }
    
    if (storedTestId) {
      setTestId(storedTestId);
    }
  }, []);

  const handleDownloadReport = async () => {
    if (!testId) {
      alert('Test ID not found. Please contact support.');
      return;
    }

    try {
      setDownloading(true);
      console.log('📥 Downloading PDF report for test:', testId);
      
      // Download PDF from backend
      const blob = await reportAPI.downloadPDF(testId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Career_Report_${testId.substring(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ PDF downloaded successfully');
    } catch (error) {
      console.error('❌ Download error:', error);
      alert('Failed to download report. Please try again or contact support.');
    } finally {
      setDownloading(false);
    }
  };

  // Commented out for now
  // const handleSendToWhatsApp = () => {
  //   const message = "I've completed my Vijna X psychometric assessment! Check out my personalized career report.";
  //   const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  //   window.open(whatsappUrl, '_blank');
  // };

  // const handleSendToEmail = () => {
  //   const subject = "My Vijna X Psychometric Assessment Report";
  //   const body = "Hi,\n\nI've completed my psychometric assessment with Vijna X. Please find my personalized career report attached.\n\nBest regards";
  //   const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  //   window.location.href = mailtoUrl;
  // };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {/* Success Animation */}
          <div className="mb-8">
            <div className="w-24 h-24 flex items-center justify-center bg-green-100 rounded-full mx-auto mb-6 animate-pulse">
              <i className="ri-check-line w-12 h-12 flex items-center justify-center text-green-600 text-4xl"></i>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Payment Successful!
            </h1>
            <p className="text-gray-600 text-lg">
              Congratulations! Your psychometric assessment has been completed.
            </p>
          </div>

          {/* Payment Details */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-8">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Transaction ID</p>
                <p className="font-semibold text-gray-900 text-xs break-all">
                  {paymentInfo?.paymentId ? `#${paymentInfo.paymentId.substring(0, 20)}...` : '#VX2024001234'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Amount Paid</p>
                <p className="font-semibold text-gray-900">₹99</p>
              </div>
              <div>
                <p className="text-gray-500">Payment Method</p>
                <p className="font-semibold text-gray-900">
                  {paymentInfo?.method ? paymentInfo.method.toUpperCase() : 'UPI'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Date & Time</p>
                <p className="font-semibold text-gray-900">
                  {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          {/* Report Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Report Contains:</h3>
            <div className="grid md:grid-cols-2 gap-4 text-left">
              <div className="flex items-center">
                <i className="ri-user-3-line w-5 h-5 flex items-center justify-center text-blue-600 mr-3"></i>
                <span className="text-gray-700">Personality Analysis</span>
              </div>
              <div className="flex items-center">
                <i className="ri-briefcase-line w-5 h-5 flex items-center justify-center text-blue-600 mr-3"></i>
                <span className="text-gray-700">Career Recommendations</span>
              </div>
              <div className="flex items-center">
                <i className="ri-book-line w-5 h-5 flex items-center justify-center text-blue-600 mr-3"></i>
                <span className="text-gray-700">Subject Selection Guide</span>
              </div>
              <div className="flex items-center">
                <i className="ri-lightbulb-line w-5 h-5 flex items-center justify-center text-blue-600 mr-3"></i>
                <span className="text-gray-700">Learning Style Assessment</span>
              </div>
              <div className="flex items-center">
                <i className="ri-target-line w-5 h-5 flex items-center justify-center text-blue-600 mr-3"></i>
                <span className="text-gray-700">Strengths & Weaknesses</span>
              </div>
              <div className="flex items-center">
                <i className="ri-road-map-line w-5 h-5 flex items-center justify-center text-blue-600 mr-3"></i>
                <span className="text-gray-700">Future Roadmap</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleDownloadReport}
              disabled={downloading || !testId}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 disabled:transform-none whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
            >
              {downloading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  Generating PDF...
                </div>
              ) : (
                <>
                  <i className="ri-download-line w-6 h-6 flex items-center justify-center mr-2 inline-block"></i>
                  Download Report PDF
                </>
              )}
            </button>

            {/* Commented out for now
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={handleSendToWhatsApp}
                className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-whatsapp-line w-5 h-5 flex items-center justify-center mr-2 inline-block"></i>
                Share on WhatsApp
              </button>

              <button
                onClick={handleSendToEmail}
                className="bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-mail-line w-5 h-5 flex items-center justify-center mr-2 inline-block"></i>
                Send to Email
              </button>
            </div>
            */}
          </div>

          {/* Support Information */}
          <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-2xl">
            <h4 className="font-semibold text-yellow-800 mb-2">Need Help Understanding Your Report?</h4>
            <p className="text-yellow-700 text-sm mb-3">
              Our career counselors are available to help you interpret your results and plan your next steps.
            </p>
            <div className="flex justify-center space-x-4 text-sm">
              <a href="tel:+919876543210" className="text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap cursor-pointer">
                📞 +91 98765 43210
              </a>
              <span className="text-gray-400">|</span>
                              <a href="mailto:support@careercompass.com" className="text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap cursor-pointer">
                  ✉️ support@careercompass.com
              </a>
            </div>
          </div>

          {/* Return Home */}
          <div className="mt-8 text-center">
            <button
              onClick={() => window.REACT_APP_NAVIGATE('/')}
              className="text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap cursor-pointer"
            >
              ← Return to Home
            </button>
          </div>
        </div>

        {/* Thank You Message */}
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Thank you for choosing <span className="font-bold text-blue-600">Vijna X</span> for your career guidance journey!
          </p>
        </div>
      </div>
    </div>
  );
}
