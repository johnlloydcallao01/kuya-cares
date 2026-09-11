'use client';

import React, { useState } from 'react';
import Image from '@/components/ui/ImageWrapper';
import { useRouter } from 'next/navigation';
import { PublicRoute } from '@/components/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSend = async () => {
    setMessage('');
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('https://cms.tap2goph.com/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setMessage('If an account exists, an email has been sent.');
        setEmail('');
      } else {
        setMessage('If an account exists, an email has been sent.');
      }
    } catch {
      setMessage('If an account exists, an email has been sent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicRoute>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
        <div className="min-h-screen flex">
          <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-[#222] to-[#222] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>')`,
              }}></div>
            </div>
            <div className="relative z-10 flex flex-col px-12 py-5 text-white">
              <div className="max-w-md">
                <div className="mb-6">
                  <button
                    onClick={() => router.back()}
                    className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <i className="fa fa-arrow-left text-white"></i>
                  </button>
                </div>
                <div className="mb-8">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4">
                    <Image
                      src="/logo.png"
                      alt="Tap2Go Logo"
                      width={64}
                      height={64}
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <h1 className="text-3xl font-bold mb-2">Tap2Go</h1>
                  <p className="text-blue-100">Food Delivery from Laguna</p>
                </div>

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

          <div className="w-full lg:w-3/5 flex items-center justify-center px-1.5 py-4 lg:p-8 relative">
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
              <div className="lg:hidden mb-8">
                <button
                  onClick={() => router.back()}
                  className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center mb-6 hover:shadow-lg transition-shadow"
                >
                  <i className="fa fa-arrow-left text-gray-600"></i>
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <div className="hidden lg:block text-center mb-8">
                  <Image
                    src="/logo.png"
                    alt="Tap2Go Logo"
                    width={64}
                    height={64}
                    className="mx-auto mb-3"
                    style={{ objectFit: 'contain' }}
                  />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h2>
                  <p className="text-gray-600">Enter your email to receive a reset link</p>
                </div>

                <div className="lg:hidden text-center mb-6">
                  <Image
                    src="/logo.png"
                    alt="Tap2Go Logo"
                    width={64}
                    height={64}
                    className="mx-auto mb-3"
                    style={{ objectFit: 'contain' }}
                  />
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Forgot Password</h2>
                  <p className="text-gray-600 text-sm">Enter your email to receive a reset link</p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <i className="fa fa-exclamation-circle text-red-400"></i>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {message && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <i className="fa fa-check-circle text-green-400"></i>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-green-800">{message}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => router.push('/signin')}
                      className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                    >
                      <i className="fa fa-arrow-left"></i>
                      Previous
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-normal mb-2" style={{ color: '#555' }}>Email Address *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#201a7c]/20 focus:border-[#201a7c] transition-all duration-200 text-gray-900 bg-gray-50 focus:bg-white"
                      placeholder="john.smith@example.com"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button type="button" onClick={() => router.push('/signin')} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Cancel</button>
                    <button type="button" onClick={handleSend} disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-[#eba336] text-white font-semibold disabled:opacity-50">
                      {isSubmitting ? 'Sending...' : 'Send reset link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicRoute>
  );
}
