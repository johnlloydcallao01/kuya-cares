'use client';

import React, { useState, useEffect } from 'react';
import Image from '@/components/ui/ImageWrapper';
import { useRouter } from 'next/navigation';
import { FlatUserRegistrationSchema, type FlatUserRegistrationData } from '@/server/validators/user-registration-schemas';

/**
 * Modern Professional Registration Page
 * Responsive design with split layout for desktop and mobile-optimized forms
 */

export default function RegisterPage(): React.ReactNode {
  const router = useRouter();

  // 🚀 ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const [isSignUp] = useState(true); // Always true for register page
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to get initial form data
  const getInitialFormData = () => {
    const shouldPrefill = process.env.NEXT_PUBLIC_DEBUG_FORMS === 'true';

    if (shouldPrefill) {
      return {
        // Personal Information
        firstName: 'Juan',
        middleName: 'Ponze',
        lastName: 'Enrile',
        nameExtension: 'Jr',
        gender: 'male' as const,
        civilStatus: 'single' as const,
        srn: 'SRN-343',
        nationality: 'Filipino',
        birthDate: '2000-12-28',
        placeOfBirth: 'Manila, Philippines',
        completeAddress: 'Manila, Philippines',

        // Contact Information
        email: 'carlos@gmail.com',
        phoneNumber: '+639092809767',

        // Username & Password
        username: 'juancarlos',
        password: '@Iamachessgrandmaster23',

        // Marketing
        couponCode: '',
        referralSource: 'social_media',

        // Terms
        agreeToTerms: true,
      };
    }

    return {
      // Personal Information
      firstName: '',
      middleName: '',
      lastName: '',
      nameExtension: '',
      gender: '' as any,
      civilStatus: '' as any,
      srn: '',
      nationality: '',
      birthDate: '',
      placeOfBirth: '',
      completeAddress: '',

      // Contact Information
      email: '',
      phoneNumber: '',

      // Username & Password
      username: '',
      password: '',

      // Marketing
      couponCode: '',
      referralSource: '',

      // Terms
      agreeToTerms: false,
    };
  };

  const [formData, setFormData] = useState<Omit<FlatUserRegistrationData,
    'emergencyFirstName' | 'emergencyMiddleName' | 'emergencyLastName' |
    'emergencyContactNumber' | 'emergencyRelationship' | 'emergencyCompleteAddress' |
    'confirmPassword'
  >>(getInitialFormData());

  // Dropdown options for form fields
  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
    { value: 'prefer_not_to_say', label: 'Prefer not to say' }
  ];

  const civilStatusOptions = [
    { value: 'single', label: 'Single' },
    { value: 'married', label: 'Married' },
    { value: 'divorced', label: 'Divorced' },
    { value: 'widowed', label: 'Widowed' },
    { value: 'separated', label: 'Separated' }
  ];

  const referralSourceOptions = [
    { value: 'social_media', label: 'Social Media' },
    { value: 'search_engine', label: 'Search Engine' },
    { value: 'friend_referral', label: 'Friend Referral' },
    { value: 'advertisement', label: 'Advertisement' },
    { value: 'relative', label: 'Relative' },
    { value: 'other', label: 'Other' }
  ];

  

  // Helper function to display field errors
  const getFieldError = (fieldName: string) => {
    return errors[fieldName];
  };

  const renderFieldError = (fieldName: string) => {
    const error = getFieldError(fieldName);
    if (!error) return null;

    return (
      <p className="mt-1 text-sm text-red-600">
        <i className="fa fa-exclamation-circle mr-1"></i>
        {error}
      </p>
    );
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const navigateToSignin = () => {
    router.push('/signin');
  };

  // Show error function
  const showError = (message: string) => {
    setErrors({ general: message });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const requiredFields = [
        'firstName', 'lastName',
        'email', 'password'
      ] as const;

      const newErrors: Record<string, string> = {};

      requiredFields.forEach((field) => {
        const value = (formData as any)[field];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          newErrors[field] = 'This field is required.';
        }
      });

      

      if ((formData as any)['agreeToTerms'] !== true) {
        newErrors['agreeToTerms'] = 'You must agree to the terms and conditions';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // CORS is completely disabled on the CMS - use direct URL
      const registrationUrl = 'https://cms.tap2goph.com/api/customer-register';

      // Build payload excluding non-processed fields
      const derivedUsername = (formData.email || '').split('@')[0] || (formData.username || '');

      const payload = {
        firstName: formData.firstName,
        middleName: (formData as any).middleName,
        lastName: formData.lastName,
        email: formData.email,
        username: derivedUsername,
        password: formData.password,
        agreeToTerms: (formData as any).agreeToTerms,
      };

      const response = await fetch(registrationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ REGISTRATION SUCCESS:', result.message || 'Registration successful');

        // Reset form after successful registration
        setFormData(getInitialFormData());

        // Show success state in UI instead of popup
        setErrors({ success: result.message || 'Registration successful! Your customer account has been created.' });
      } else {
        // Try to get the response text first, then parse as JSON
        const responseText = await response.text();

        let error: any;
        try {
          error = JSON.parse(responseText);
        } catch (parseError) {
          error = { error: 'Server returned invalid JSON', rawResponse: responseText };
        }

        // Show more specific error messages based on error type
        let errorMessage = 'Registration failed. Please try again.';

        if (error?.type === 'duplicate') {
          errorMessage = error.message || `This ${error.field || 'information'} is already registered. Please use different information.`;
        } else if (error?.type === 'validation') {
          errorMessage = error.message || 'Please check your form data and try again.';

          // If there are specific field errors, show them
          if (error?.details && typeof error.details === 'object') {
            // You could set specific field errors here if needed
          }
        } else if (error?.type === 'server_error') {
          errorMessage = error.message || 'We encountered a server error. Please try again in a few moments.';
        } else {
          errorMessage = error?.error || error?.message || 'Registration failed. Please try again.';
        }

        showError(errorMessage);
      }
    } catch (error) {
      console.error('❌ REGISTRATION ERROR:', error);
      showError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
                  Create Your Account
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
                <h2 className="text-xl font-bold text-gray-900 mb-1">Create Account</h2>
                <p className="text-gray-600 text-sm">One Tap, Brings Yum</p>
              </div>

              {/* Error Messages */}
              {errors.general && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center">
                    <i className="fa fa-exclamation-circle text-red-500 mr-2"></i>
                    <p className="text-red-700 text-sm">{errors.general}</p>
                  </div>
                </div>
              )}

              {/* Success Messages */}
              {errors.success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center">
                    <i className="fa fa-check-circle text-green-500 mr-2"></i>
                    <p className="text-green-700 text-sm">{errors.success}</p>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Registration Fields */}
                <div className="space-y-8">
                  {/* Personal Information Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                      Personal Information
                    </h3>

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-normal mb-2" style={{ color: '#555' }}>
                          First Name *
                        </label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white ${
                            getFieldError('firstName')
                              ? 'border-red-300 focus:ring-red-200 focus:border-red-500'
                              : 'border-gray-200 focus:ring-[#201a7c]/20 focus:border-[#201a7c]'
                          }`}
                          placeholder="Juan"
                        />
                        {renderFieldError('firstName')}
                      </div>
                      <div>
                        <label className="block text-sm font-normal mb-2" style={{ color: '#555' }}>
                          Middle Name
                        </label>
                        <input
                          type="text"
                          name="middleName"
                          value={formData.middleName}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#201a7c]/20 focus:border-[#201a7c] transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                          placeholder="Carlos"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-normal mb-2" style={{ color: '#555' }}>
                          Last Name *
                        </label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#201a7c]/20 focus:border-[#201a7c] transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                          placeholder="Dela Cruz"
                        />
                      </div>
                    </div>

                    

                    

                    

                    
                  </div>

                  

                  {/* Email & Password Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                      Email & Password
                    </h3>

                    <div className="space-y-4">
                      {/* Username and Password - 50/50 on desktop */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-normal mb-2" style={{ color: '#555' }}>
                            Email *
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#201a7c]/20 focus:border-[#201a7c] transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                            placeholder="juan.delacruz@example.com"
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
                      </div>

                      
                    </div>
                  </div>

                  

                  

                  {/* Terms Agreement */}
                  <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                      required
                      className="mt-1 w-4 h-4 text-[#201a7c] border-gray-300 rounded focus:ring-[#201a7c]"
                    />
                    <label className="text-sm text-gray-600">
                      I agree to the{' '}
                      <a href="#" className="text-[#eba336] hover:underline font-medium">Terms of Service</a>
                      {' '}and{' '}
                      <a href="#" className="text-[#eba336] hover:underline font-medium">Privacy Policy</a>
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}

                  className="w-full bg-[#eba336] text-white py-4 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <i className="fa fa-spinner fa-spin mr-2"></i>
                      Creating Account...
                    </div>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>

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
                    Already have an account?
                  </p>
                  <button
                    onClick={navigateToSignin}
                    className="mt-2 text-[#eba336] font-semibold hover:text-[#d68e2d] transition-colors duration-200"
                  >
                    Sign In Instead
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
