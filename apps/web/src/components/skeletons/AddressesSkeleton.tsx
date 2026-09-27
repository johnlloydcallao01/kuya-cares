import React from 'react';

export function AddressesPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="w-full px-3 sm:px-4 py-4 animate-pulse">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-4 w-64 bg-gray-200 rounded" />
            </div>
            <div className="h-10 w-32 bg-gray-200 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full px-3 sm:px-4 py-4 grid grid-cols-1 lg:grid-cols-2 gap-3.5 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 bg-gray-200 rounded-full" />
              <div className="h-5 w-20 bg-gray-200 rounded-full" />
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-full bg-gray-200 rounded mb-4" />
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-gray-200 rounded-xl" />
              <div className="flex-1 h-9 bg-gray-200 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
