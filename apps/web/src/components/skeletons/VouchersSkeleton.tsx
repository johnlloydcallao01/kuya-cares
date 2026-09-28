import React from 'react';

export function VouchersPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="w-full px-3 sm:px-4 py-4 animate-pulse">
          <div className="h-8 w-44 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="flex gap-2 mt-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-28 bg-gray-200 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full px-3 sm:px-4 py-4 animate-pulse">
        <div className="h-14 bg-white rounded-2xl shadow-sm mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="h-12 bg-gray-200 rounded-lg mb-3" />
              <div className="h-10 bg-gray-200 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
