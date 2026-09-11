'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from '@/components/ui/ImageWrapper';
import { ArrowLeft, AlertCircle, Loader2, CheckCircle, Mail } from '@/components/ui/IconWrapper';
import { PublicRoute } from '@/components/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, app: 'merchant', origin: typeof window !== 'undefined' ? window.location.origin : '' }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 429) {
        setError((data as { error?: string })?.error || 'Too many requests. Please try again later.');
        return;
      }
      // Enumeration-safe: always show success if not rate-limited
      setMessage('If an account exists, a password reset email has been sent.');
      setEmail('');
    } catch {
      setMessage('If an account exists, a password reset email has been sent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicRoute redirectTo="/dashboard/overview">
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
        <div className="min-h-screen flex">
          {/* Left Side - Merchant Branding (hidden on mobile) */}
          <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden bg-gradient-to-br from-black via-[#1a1a1a] to-[#eba236] border-r border-[#eba236]/20">
            <div className="absolute inset-0 opacity-[0.08]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='g' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 10 0 L 0 0 0 10' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E")`
            }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute -right-16 -top-10 w-64 h-64 bg-[#eba236]/20 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -left-12 bottom-0 w-72 h-72 bg-[#c88a20]/15 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col px-12 py-5 text-white w-full">
              <div className="max-w-md">
                <div className="mb-10">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm border border-white/10">
                    <Image src="/logo.png" alt="Tap2Go Logo" width={64} height={64} style={{ objectFit: 'contain' }} />
                  </div>
                  <h1 className="text-3xl font-bold mb-2">Tap2Go</h1>
                  <p className="text-[#eba236] text-lg font-medium">Merchant Portal</p>
                </div>
                <p className="text-gray-300 text-base leading-relaxed max-w-sm">
                  Manage your restaurant, track orders, and grow your business — all from one powerful dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Right Side - Forgot Password Form */}
          <div className="w-full lg:w-3/5 flex items-center justify-center px-4 py-8 lg:p-8 bg-gray-50 dark:bg-[#0a0a0a]">
            <div className="w-full max-w-lg md:max-w-xl">
              {/* Mobile Header */}
              <div className="lg:hidden mb-6">
                <button
                  onClick={() => router.push('/signin')}
                  className="w-10 h-10 rounded-full bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] shadow-md flex items-center justify-center hover:shadow-lg hover:bg-gray-50 dark:hover:bg-[#262626] transition-all"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-[#a1a1aa]" />
                </button>
              </div>

              {/* Form Card */}
              <div className="bg-white dark:bg-[#171717] rounded-2xl shadow-xl border border-gray-200 dark:border-[#262626] p-8">
                {/* Desktop Header */}
                <div className="hidden lg:block mb-8">
                  <button
                    type="button"
                    onClick={() => router.push('/signin')}
                    className="inline-flex items-center gap-2 text-sm text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-[#ededed] mb-6 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-[#ededed] mb-2">
                    Forgot Password
                  </h2>
                  <p className="text-gray-500 dark:text-[#a1a1aa]">
                    Enter your email to receive a password reset link
                  </p>
                </div>

                {/* Mobile Header */}
                <div className="lg:hidden text-center mb-6">
                  <Image src="/logo.png" alt="Tap2Go Logo" width={56} height={56} className="mx-auto mb-3" style={{ objectFit: 'contain' }} />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-[#ededed] mb-1">
                    Forgot Password
                  </h2>
                  <p className="text-gray-500 dark:text-[#a1a1aa] text-sm">
                    Enter your email to receive a reset link
                  </p>
                </div>

                <form onSubmit={handleSend} className="space-y-5">
                  {error && (
                    <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {message && (
                    <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-[#a1a1aa] mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-[#c88a20] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed"
                        placeholder="you@restaurant.com"
                        required
                        disabled={isSubmitting}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-black hover:bg-[#1a1a1a] dark:bg-[#eba236] dark:hover:bg-[#c88a20] text-white dark:text-black py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-[#eba236]/20 flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-[#eba236] dark:text-black" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Reset Link</span>
                    )}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/signin')}
                    className="text-sm text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-[#ededed] transition-colors"
                  >
                    Remembered your password? Sign in
                  </button>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-xs text-gray-400 dark:text-[#a1a1aa]">
                  &copy; 2025 Tap2Go. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicRoute>
  );
}
