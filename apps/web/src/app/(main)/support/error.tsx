'use client';

import { useEffect } from 'react';

export default function SupportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Support route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-xl" />
        </div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-2">Couldn&apos;t load support</h2>
        <p className="text-sm text-gray-500 mb-5">
          {error?.message || 'Something went wrong loading your tickets.'}
        </p>
        <button
          onClick={() => reset()}
          className="w-full py-2.5 text-white rounded-xl font-bold text-sm hover:opacity-90"
          style={{ backgroundColor: '#239459' }}
        >
          <i className="fas fa-redo mr-2" />
          Try again
        </button>
      </div>
    </div>
  );
}
