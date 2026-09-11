import React from 'react';
import Image from 'next/image';

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Logo Section */}
        <div className="flex justify-center">
          <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-lg">
            {/* Using explicit width/height instead of fill to ensure reliability */}
            <Image
              src="/logo.webp"
              alt="Tap2Go Logo"
              width={128}
              height={128}
              className="h-full w-full object-cover"
              priority
              unoptimized // Added unoptimized just in case there's an issue with the image optimization service locally
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-900/5 sm:p-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Under Maintenance
          </h2>
          
          <div className="mt-6 flex justify-center">
            <div className="h-1 w-20 rounded-full bg-orange-500"></div>
          </div>

          <p className="mt-6 text-lg leading-8 text-gray-600">
            We're currently updating our platform to serve you better. 
            Tap2Go will be back online shortly with improved features and performance.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 text-sm text-gray-500">
            <p>Thank you for your patience.</p>
            <div className="flex items-center gap-2 rounded-full bg-orange-50 px-4 py-2 text-orange-700">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500"></span>
              </span>
              <span>System Upgrade in Progress</span>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <p className="text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Tap2Go. All rights reserved.
        </p>
      </div>
    </div>
  );
}
