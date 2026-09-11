'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from '@/components/ui/ImageWrapper';
import { ArrowLeft, AlertCircle, Loader2, CheckCircle, Eye, EyeOff, Lock } from '@/components/ui/IconWrapper';
import { PublicRoute } from '@/components/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const minLen = 8;
  const maxLen = 40;

  const checks = useMemo(() => {
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
    const lenOk = newPassword.length >= minLen && newPassword.length <= maxLen;
    const match = newPassword.length > 0 && newPassword === confirmPassword;
    return { hasUpper, hasNumber, hasSpecial, lenOk, match };
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token') || '';
      setToken(t);
    } catch {
      setToken('');
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!token) {
      setError('Invalid or expired reset link.');
      return;
    }
    if (!(checks.lenOk && checks.hasUpper && checks.hasNumber && checks.hasSpecial && checks.match)) {
      setError('Password must be 8-40 chars, include uppercase, number, special, and match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (res.ok) {
        setIsSuccess(true);
        setMessage('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        try {
          const txt = await res.text();
          const data = txt ? JSON.parse(txt) : {};
          if (data?.errorCode === 'RATE_LIMITED') {
            setError('Too many attempts. Please try again later.');
          } else if (data?.errorCode === 'TOKEN_EXPIRED') {
            setError('Reset link expired. Please request a new link.');
          } else if (data?.errorCode === 'TOKEN_INVALID') {
            setError('Invalid reset link. Please request a new link.');
          } else if (data?.errorCode === 'PASSWORD_POLICY_FAILED') {
            setError('Password must be 8-40 chars, include uppercase, number, and special.');
          } else if (typeof data?.error === 'string') {
            setError(data.error);
          } else {
            setError('Invalid or expired reset link.');
          }
        } catch {
          setError('Invalid or expired reset link.');
        }
      }
    } catch {
      setError('An unexpected error occurred.');
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

          {/* Right Side - Reset Password Form */}
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
                    Reset Password
                  </h2>
                  <p className="text-gray-500 dark:text-[#a1a1aa]">
                    Choose a new password for your account
                  </p>
                </div>

                {/* Mobile Header */}
                <div className="lg:hidden text-center mb-6">
                  <Image src="/logo.png" alt="Tap2Go Logo" width={56} height={56} className="mx-auto mb-3" style={{ objectFit: 'contain' }} />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-[#ededed] mb-1">
                    Reset Password
                  </h2>
                  <p className="text-gray-500 dark:text-[#a1a1aa] text-sm">
                    Choose a new password for your account
                  </p>
                </div>

                {isSuccess ? (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Your password has been reset successfully. You can now sign in with your new password.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/signin')}
                      className="w-full bg-black hover:bg-[#1a1a1a] dark:bg-[#eba236] dark:hover:bg-[#c88a20] text-white dark:text-black py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl border border-[#eba236]/20"
                    >
                      Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-5">
                    {error && (
                      <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-[#a1a1aa] mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          id="newPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-12 pr-12 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-[#c88a20] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed"
                          placeholder="Enter new password"
                          required
                          disabled={isSubmitting}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-[#ededed] transition-colors disabled:cursor-not-allowed"
                          disabled={isSubmitting}
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-[#a1a1aa] mb-2">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="w-5 h-5 text-gray-400 dark:text-[#a1a1aa] absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-12 pr-12 py-2.5 border border-gray-300 dark:border-[#262626] rounded-xl bg-white dark:bg-[#171717] text-gray-900 dark:text-[#ededed] placeholder:text-gray-400 dark:placeholder:text-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#eba236] focus:border-[#c88a20] transition-all duration-200 text-sm disabled:bg-gray-100 dark:disabled:bg-[#262626] disabled:cursor-not-allowed"
                          placeholder="Confirm new password"
                          required
                          disabled={isSubmitting}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#a1a1aa] hover:text-gray-600 dark:hover:text-[#ededed] transition-colors disabled:cursor-not-allowed"
                          disabled={isSubmitting}
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Password Requirements */}
                    <div className="bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa] mb-2">Password must:</p>
                      <ul className="space-y-1 text-xs">
                        <li className={checks.lenOk ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-[#a1a1aa]'}>
                          Be between {minLen} and {maxLen} characters
                        </li>
                        <li className={checks.hasUpper ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-[#a1a1aa]'}>
                          Include at least one uppercase letter
                        </li>
                        <li className={checks.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-[#a1a1aa]'}>
                          Include at least one number
                        </li>
                        <li className={checks.hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-[#a1a1aa]'}>
                          Include at least one special character
                        </li>
                        <li className={checks.match ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-[#a1a1aa]'}>
                          Match the confirmation field
                        </li>
                      </ul>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-black hover:bg-[#1a1a1a] dark:bg-[#eba236] dark:hover:bg-[#c88a20] text-white dark:text-black py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-[#eba236]/20 flex items-center justify-center space-x-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-[#eba236] dark:text-black" />
                          <span>Resetting...</span>
                        </>
                      ) : (
                        <span>Reset Password</span>
                      )}
                    </button>
                  </form>
                )}
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
