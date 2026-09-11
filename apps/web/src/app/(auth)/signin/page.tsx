'use client';

import React, { useState, useEffect } from 'react';
import Image from '@/components/ui/ImageWrapper';
import { useRouter } from 'next/navigation';
import { PublicRoute } from '@/components/auth';
import { useLogin } from '@/hooks/useAuth';
import { validateUserRegistration, type FlatUserRegistrationData } from '@/server/validators/user-registration-schemas';

// Simple signin form data type
type SigninFormData = {
  email: string;
  password: string;
};



/**
 * Modern Professional Sign In / Sign Up Page
 * Responsive design with split layout for desktop and mobile-optimized forms
 */

function SignInContent() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useLogin();

  // 🚀 ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const [isSignUp] = useState(false); // Always false for signin page
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper function to get initial form data - simplified for signin only
  const getInitialFormData = () => {
    const shouldPrefill = process.env.NEXT_PUBLIC_DEBUG_FORMS === 'true';

    if (shouldPrefill) {
      return {
        email: 'carlos@gmail.com',
        password: '@Iamachessgrandmaster23'
      };
    }

    return {
      email: '',
      password: ''
    };
  };

  const [formData, setFormData] = useState<SigninFormData>(() => getInitialFormData());

  // Clear errors when component mounts or when auth error changes
  useEffect(() => {
    if (error) {
      setErrors({ general: error });
    } else {
      setErrors({});
    }
  }, [error]);

  // Professional error handling - no popup alerts
  const showError = (message: string) => {
    console.error('❌ LOGIN ERROR:', message);
    // Set error state instead of showing alert
    setErrors({ general: message });
  };



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    clearError();

    // Validate form data
    if (!formData.email || !formData.password) {
      showError('Please fill in all required fields.');
      return;
    }

    try {
      // Attempt login with PayloadCMS
      await login({
        email: formData.email,
        password: formData.password,
      });

      // Store the redirect URL for the PublicRoute component to use
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get('redirect') || '/';

      if (redirectTo !== '/') {
        sessionStorage.setItem('auth:redirectAfterLogin', redirectTo);
      }

      console.log('🔄 REDIRECT STORED:', redirectTo);

      // Don't manually redirect - let the authentication system handle it
      // The PublicRoute component will automatically redirect authenticated users
    } catch (error) {
      console.error('❌ LOGIN ERROR:', error);
      // Error is already handled by useLogin hook and displayed in UI
    }
  };

  

  

  const navigateToRegister = () => {
    router.push('/register');
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
      {/* Debug Mode Indicator */}
      {process.env.NEXT_PUBLIC_DEBUG_FORMS === 'true' && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <i className="fa fa-exclamation-triangle text-yellow-500"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                🚧 Debug Mode Active: Forms are pre-filled with test data
              </p>
              <p className="text-xs mt-1">
                Set NEXT_PUBLIC_DEBUG_FORMS=false in .env.local to disable
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modern Split Layout */}
      <div className="min-h-screen flex">
        {/* Left Side - Branding & Info (Hidden on mobile) */}
        <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-[#222] to-[#222] relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>')`,
            }}></div>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col px-12 py-5 text-white">
            <div className="max-w-md">
              {/* Back Button */}
              <div className="mb-6">
                <button
                  onClick={() => router.back()}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <i className="fa fa-arrow-left text-white"></i>
                </button>
              </div>

              {/* Logo */}
              <div className="mb-8">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                  <Image
                    src="/logo.png"
                    alt="Calsiter Inc Logo"
                    width={64}
                    height={64}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <h1 className="text-3xl font-bold mb-2">Tap2Go</h1>
                <p className="text-blue-100">Food Delivery from Laguna</p>
              </div>

              {/* Features */}
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fa fa-shopping-cart text-sm"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Fast Delivery</h3>
                    <p className="text-blue-100 text-sm">Quick delivery across Laguna</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fa fa-certificate text-sm"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Trusted Restaurants</h3>
                    <p className="text-blue-100 text-sm">Curated local favorites from verified partners</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <i className="fa fa-users text-sm"></i>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Real-Time Tracking</h3>
                    <p className="text-blue-100 text-sm">Track your order live from kitchen to doorstep</p>
                  </div>
                </div>
              </div>

              
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div
          className="w-full lg:w-3/5 flex items-center justify-center px-1.5 py-4 lg:p-8 relative"
        >
          <div
            className="absolute inset-0 opacity-80"
            style={{
              backgroundImage: `url('https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          ></div>
          <div className="w-full max-w-lg md:max-w-2xl relative z-10">
            {/* Mobile Header */}
            <div className="lg:hidden mb-8">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center mb-6 hover:shadow-lg transition-shadow"
              >
                <i className="fa fa-arrow-left text-gray-600"></i>
              </button>

            </div>

              {/* Form Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                {/* Desktop Header */}
                <div className="hidden lg:block text-center mb-8">
                  <Image
                    src="/logo.png"
                    alt="Tap2Go Logo"
                    width={64}
                    height={64}
                    className="mx-auto mb-3"
                    style={{ objectFit: 'contain' }}
                  />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Welcome Back
                  </h2>
                  <p className="text-gray-600">
                    One Tap, Brings Yum
                  </p>
                </div>

              {/* Mobile Form Header */}
              <div className="lg:hidden text-center mb-6">
                <Image
                  src="/logo.png"
                  alt="Tap2Go Logo"
                  width={64}
                  height={64}
                  className="mx-auto mb-3"
                  style={{ objectFit: 'contain' }}
                />
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Welcome Back
                </h2>
                <p className="text-gray-600 text-sm">
                  One Tap, Brings Yum
                </p>
              </div>

              {/* General Error/Success Messages */}
              {errors.general && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <i className="fa fa-exclamation-circle text-red-400"></i>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{errors.general}</p>
                    </div>
                  </div>
                </div>
              )}

              {errors.success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <i className="fa fa-check-circle text-green-400"></i>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-800">{errors.success}</p>
                    </div>
                  </div>
                </div>
              )}

              {
                <form onSubmit={handleSubmit} className="space-y-6">
                  {!isSignUp && (
                    <>
                      <div>
                        <label className="block text-sm font-normal mb-2" style={{ color: '#555' }}>
                          Email Address *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#201a7c]/20 focus:border-[#201a7c] transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                          placeholder="john.smith@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-normal mb-2" style={{ color: '#555' }}>
                          Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#201a7c]/20 focus:border-[#201a7c] transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                            placeholder="Enter your password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                  {!isSignUp && (
                    <div className="text-right">
                      <a href="#" onClick={(e) => { e.preventDefault(); router.push('/signin/forgot-password'); }} className="text-sm text-[#eba336] hover:underline font-medium">
                        Forgot your password?
                      </a>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#eba336] text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <i className="fa fa-spinner fa-spin mr-2"></i>
                        Signing In...
                      </div>
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>
              }

              {/* Toggle Form */}
              <div className="mt-8 text-center">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">or</span>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm text-gray-600">
                    Don&apos;t have an account?
                  </p>
                  <button
                    onClick={navigateToRegister}
                    className="mt-2 text-[#eba336] font-semibold hover:text-[#d68e2d] transition-colors duration-200"
                  >
                    Create New Account
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

export default function SignInPage() {
  return (
    <PublicRoute>
      <SignInContent />
    </PublicRoute>
  );
}
