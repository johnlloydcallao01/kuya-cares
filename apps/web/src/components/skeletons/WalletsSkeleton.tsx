import React from 'react';

export function WalletsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="w-full px-3 sm:px-4 py-4 animate-pulse">
          <div className="h-8 w-44 bg-gray-200 rounded mb-2" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="mt-4 bg-gray-200 rounded-2xl h-40" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full px-3 sm:px-4 py-4 space-y-3 animate-pulse">
        <div className="h-14 bg-white rounded-2xl shadow-sm" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
