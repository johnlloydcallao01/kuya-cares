import React from 'react';

export function SettingsPageSkeleton() {
  return (
    <div className="settings-theme min-h-screen bg-gray-50 pb-20">
      <div className="w-full px-2.5 py-5 space-y-0 animate-pulse">
        <div className="h-[156px] sm:h-[184px] rounded-t-2xl bg-gray-200" />
        <div className="bg-white border border-gray-200 border-t-0 rounded-b-2xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 -mt-14 sm:-mt-16">
            <div className="flex-shrink-0">
              <div className="w-[112px] h-[112px] sm:w-[128px] sm:h-[128px] rounded-2xl bg-gray-200 border-4 border-white shadow-xl" />
            </div>
            <div className="flex-1 space-y-3 pt-2 min-w-0">
              <div className="h-7 bg-gray-200 rounded w-1/3" />
              <div className="flex flex-wrap gap-2">
                <div className="h-5 w-28 bg-gray-200 rounded-full" />
                <div className="h-5 w-20 bg-gray-200 rounded-full" />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="h-3 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-28 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="lg:w-[320px] space-y-3 w-full">
              <div className="h-28 bg-gray-100 rounded-xl p-4 space-y-2">
                <div className="h-3 w-28 bg-gray-200 rounded" />
                <div className="h-2 bg-gray-200 rounded-full" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-10 bg-gray-200 rounded-xl" />
                <div className="h-10 w-24 bg-gray-200 rounded-xl" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-2 border-t border-gray-100 pt-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-28 bg-gray-200 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full px-2.5 grid grid-cols-12 gap-5 animate-pulse">
        <div className="col-span-12 lg:col-span-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
                <div className="h-5 w-12 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
