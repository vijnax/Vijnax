
import { useState } from 'react';
import { authAPI } from '../../services/api.js';

export default function OtpLogin() {
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    if (mobileNumber.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
        const response = await authAPI.sendOTP(mobileNumber);
        
        if (response.success) {
          setStep('otp');
        } else {
          setError(response.message || 'Failed to send OTP');
      }
    } catch (error) {
        setError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
        const response = await authAPI.verifyOTP(mobileNumber, otp);
        
        if (response.success) {
          // Store token
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          // Navigate to test instructions
          window.REACT_APP_NAVIGATE('/test-instructions');
        } else {
          setError(response.message || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
        setError(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    setOtp('');
    setError('');
    handleSendOtp();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Enhanced background elements */}
      <div className="absolute inset-0 bg-cover bg-center opacity-5" style={{
        backgroundImage: `url(https://readdy.ai/api/search-image?query=Modern%20educational%20workspace%20with%20floating%20books%2C%20digital%20tablets%2C%20mathematical%20formulas%2C%20and%20learning%20icons%20in%20soft%20pastel%20colors%2C%20minimalist%20geometric%20design%20perfect%20for%20login%20interface%20background&width=1920&height=1080&seq=login-bg-enhanced&orientation=landscape)`
      }}></div>
      
      {/* Floating decorative elements */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-blue-200/20 rounded-full blur-2xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-200/20 rounded-full blur-2xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 right-20 w-24 h-24 bg-indigo-200/20 rounded-full blur-xl animate-pulse delay-500"></div>
      
      <div className="relative z-10 max-w-md w-full">
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl">
              <i className="ri-smartphone-line w-10 h-10 flex items-center justify-center text-white text-2xl"></i>
            </div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-3" style={{fontFamily: "Pacifico, serif"}}>
              Career Compass
            </h1>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {step === 'mobile' ? 'Welcome Back!' : 'Verify Your Number'}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {step === 'mobile' 
                ? 'Enter your mobile number to access your personalized assessment' 
                : 'We\'ve sent a 6-digit verification code to your mobile'}
            </p>
          </div>

          {step === 'mobile' ? (
            <div className="space-y-6">
              <div>
                <label htmlFor="mobile" className="block text-sm font-bold text-gray-700 mb-3">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <div className="flex items-center">
                      <span className="text-gray-500 font-medium">🇮🇳 +91</span>
                      <div className="w-px h-6 bg-gray-300 mx-3"></div>
                    </div>
                  </div>
                  <input
                    type="tel"
                    id="mobile"
                    value={mobileNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setMobileNumber(value);
                      setError('');
                    }}
                    className="block w-full pl-20 pr-4 py-4 border-2 border-gray-200 rounded-2xl text-lg font-medium focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 bg-gray-50/50"
                    placeholder="98765 43210"
                    maxLength={10}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 ml-1">
                  We'll send you a verification code via SMS
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl">
                  <div className="flex items-center">
                    <i className="ri-error-warning-line w-5 h-5 flex items-center justify-center text-red-500 mr-2"></i>
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading || mobileNumber.length !== 10}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-2xl text-lg font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Sending OTP...
                  </div>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <i className="ri-arrow-right-line w-5 h-5 flex items-center justify-center ml-2"></i>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label htmlFor="otp" className="block text-sm font-bold text-gray-700 mb-3">
                  Verification Code
                </label>
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600 bg-blue-50 inline-flex items-center px-3 py-1 rounded-full">
                    <i className="ri-smartphone-line w-4 h-4 flex items-center justify-center text-blue-600 mr-2"></i>
                    Code sent to +91 {mobileNumber}
                  </p>
                </div>
                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(value);
                    setError('');
                  }}
                  className="block w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-2xl text-center tracking-[0.5em] font-bold focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-300 bg-gray-50/50"
                  placeholder="● ● ● ● ● ●"
                  maxLength={6}
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Enter the 6-digit code we sent to your phone
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl">
                  <div className="flex items-center">
                    <i className="ri-error-warning-line w-5 h-5 flex items-center justify-center text-red-500 mr-2"></i>
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-2xl text-lg font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 mb-4 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Verifying...
                  </div>
                ) : (
                  <>
                    <i className="ri-check-line w-5 h-5 flex items-center justify-center mr-2"></i>
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>

              {/* Resend and back options */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setStep('mobile');
                    setOtp('');
                    setError('');
                  }}
                  className="text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center whitespace-nowrap cursor-pointer transition-colors"
                >
                  <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center mr-1"></i>
                  Change Number
                </button>
                
                <button
                  onClick={handleResendOtp}
                  className="text-blue-600 hover:text-blue-700 font-semibold text-sm whitespace-nowrap cursor-pointer transition-colors"
                >
                  Resend Code
                </button>
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="mt-8 p-4 bg-green-50/50 border border-green-100 rounded-2xl">
            <div className="flex items-center text-green-800">
              <i className="ri-shield-check-line w-5 h-5 flex items-center justify-center mr-2"></i>
              <span className="font-semibold text-sm">Secure & Private</span>
            </div>
            <p className="text-green-700 text-xs mt-1">
              Your personal information is protected with bank-level security
            </p>
          </div>
        </div>
        
        {/* Illustration */}
        <div className="mt-8 text-center">
          <img 
            src="https://readdy.ai/api/search-image?query=Modern%20illustration%20of%20Indian%20students%20using%20smartphones%20for%20educational%20purposes%2C%20contemporary%20digital%20learning%20scene%20with%20diverse%20group%20of%20teenagers%2C%20clean%20and%20professional%20style%20with%20blue%20and%20purple%20color%20scheme&width=300&height=200&seq=login-illustration-enhanced&orientation=landscape"
            alt="Students with mobile devices"
            className="w-64 h-40 object-cover rounded-2xl mx-auto opacity-80 shadow-lg"
          />
        </div>
      </div>
    </div>
  );
}
