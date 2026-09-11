'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from '@/components/ui/ImageWrapper';
import { Eye, EyeOff, AlertCircle, Loader2, Store, TrendingUp, Clock, ArrowLeft, Mail, Lock } from '@/components/ui/IconWrapper';
import { useAuth } from '@/hooks/useAuth';
import { PublicRoute } from '@/components/auth';
import { AuthenticationError } from '@/lib/auth';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const searchParams = useSearchParams();
  const { login, isLoading, error: authError, clearError } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/dashboard/overview';

  useEffect(() => {
    setEmail('');
    setPassword('');
    setError('');
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearError();

    try {
      await login({ email, password });

      if (redirectTo !== '/dashboard/overview') {
        sessionStorage.setItem('auth:redirectAfterLogin', redirectTo);
      }
    } catch (err: unknown) {
      let errorMessage = 'Authentication failed. Please try again.';

      if (err instanceof AuthenticationError) {
        switch (err.type) {
          case 'ACCESS_DENIED':
            errorMessage = 'Access denied. Only vendor users can access this application.';
            break;
          case 'INVALID_CREDENTIALS':
            errorMessage = 'Invalid email or password. Please check your credentials and try again.';
            break;
          case 'ACCOUNT_LOCKED':
            errorMessage = 'Account temporarily locked due to multiple failed attempts. Please try again later.';
            break;
          case 'NETWORK_ERROR':
            errorMessage = 'Network connection failed. Please check your internet connection and try again.';
            break;
          default:
            errorMessage = err.message || errorMessage;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="min-h-screen flex">
        {/* Left Side - Merchant Branding (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden bg-gradient-to-br from-black via-[#1a1a1a] to-[#eba236] border-r border-[#eba236]/20">
          {/* Subtle grid pattern - same as /profile banner */}
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='g' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 10 0 L 0 0 0 10' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E")`
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          {/* Decorative blobs - same as /profile */}
          <div className="absolute -right-16 -top-10 w-64 h-64 bg-[#eba236]/20 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -left-12 bottom-0 w-72 h-72 bg-[#c88a20]/15 blur-3xl rounded-full pointer-events-none" />

          <div className="relative z-10 flex flex-col px-12 py-5 text-white w-full">
            <div className="max-w-md">
              {/* Logo & Brand */}
              <div className="mb-10">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm border border-white/10">
                  <Image
                    src="/logo.png"
                    alt="Tap2Go Logo"
                    width={64}
                    height={64}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <h1 className="text-3xl font-bold mb-2">Tap2Go</h1>
                <p className="text-[#eba236] text-lg font-medium">Merchant Portal</p>
              </div>

              {/* Tagline */}
              <p className="text-gray-300 text-base leading-relaxed mb-10 max-w-sm">
                Manage your restaurant, track orders, and grow your business — all from one powerful dashboard.
              </p>

              {/* Features */}
              <div className="space-y-5">
                <div className="flex items-start space-x-4">
                  <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border border-white/10 backdrop-blur-sm">
                    <Store className="w-4 h-4 text-[#eba236]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-0.5 text-white">Restaurant Management</h3>
                    <p className="text-gray-400 text-sm">Full control over your menu, pricing, and availability</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border border-white/10 backdrop-blur-sm">
                    <TrendingUp className="w-4 h-4 text-[#eba236]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-0.5 text-white">Sales Analytics</h3>
                    <p className="text-gray-400 text-sm">Real-time insights into orders, revenue, and trends</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border border-white/10 backdrop-blur-sm">
                    <Clock className="w-4 h-4 text-[#eba236]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-0.5 text-white">Order Tracking</h3>
                    <p className="text-gray-400 text-sm">Live order status from preparation to delivery</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-3/5 flex items-center justify-center px-4 py-8 lg:p-8 bg-gray-50 dark:bg-[#0a0a0a]">
          <div className="w-full max-w-lg md:max-w-xl">
            {/* Mobile Back Button */}
            <div className="lg:hidden mb-6">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-full bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] shadow-md flex items-center justify-center hover:shadow-lg hover:bg-gray-50 dark:hover:bg-[#262626] transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-[#a1a1aa]" />
              </button>
            </div>

            {/* Form Card */}
            <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-xl border border-gray-200 dark:border-[#262626] p-8">
              {/* Desktop Header */}
              <div className="hidden lg:block text-center mb-8">
                <Image
                  src="/logo.png"
                  alt="Tap2Go Logo"
                  width={56}
                  height={56}
                  className="mx-auto mb-3"
                  style={{ objectFit: 'contain' }}
                />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-[#ededed] mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-500 dark:text-[#a1a1aa]">
                  Sign in to your merchant dashboard
                </p>
              </div>

              {/* Mobile Header */}
              <div className="lg:hidden text-center mb-6">
                <Image
                  src="/logo.png"
                  alt="Tap2Go Logo"
                  width={56}
                  height={56}
                  className="mx-auto mb-3"
                  style={{ objectFit: 'contain' }}
                />
                <h2 className="text-xl font-bold text-gray-900 dark:text-[#ededed] mb-1">
                  Welcome Back
                </h2>
                <p className="text-gray-500 dark:text-[#a1a1aa] text-sm">
                  Sign in to your merchant dashboard
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-6">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-[#a1a1aa] mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-[#c88a20] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed"
                      placeholder="you@restaurant.com"
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-[#a1a1aa] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-[#c88a20] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed"
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-[#ededed] transition-colors disabled:cursor-not-allowed"
                      disabled={isLoading}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <Link
                    href="/signin/forgot-password"
                    className="text-sm text-[#c88a20] hover:text-[#eba236] font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-black hover:bg-[#1a1a1a] dark:bg-[#eba236] dark:hover:bg-[#c88a20] text-white dark:text-black py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-[#eba236]/20 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-[#eba236] dark:text-black" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              {/* Footer */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400 dark:text-[#a1a1aa]">
                  Need help? Contact your administrator
                </p>
              </div>
            </div>

            {/* Copyright */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-400 dark:text-[#a1a1aa]">
                &copy; 2025 Tap2Go. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <PublicRoute redirectTo="/dashboard/overview">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-[#eba236]" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </PublicRoute>
  );
}
