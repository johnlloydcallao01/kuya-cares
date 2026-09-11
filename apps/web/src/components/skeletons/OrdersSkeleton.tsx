import React from 'react';

export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4 animate-pulse">
      {/* Order Header Skeleton */}
      <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
          <div>
            <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
      </div>

      {/* Order Items Skeleton */}
      <div className="p-4 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0"></div>
            <div className="flex-1">
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                 <div className="h-3 w-24 bg-gray-200 rounded"></div>
              </div>
              <div className="h-3 w-16 bg-gray-200 rounded"></div>
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>

      {/* Order Footer Skeleton */}
      <div className="p-4 bg-gray-50/50 border-t border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
          <div className="h-5 w-24 bg-gray-200 rounded"></div>
        </div>
        <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-200 rounded-lg"></div>
            <div className="flex-1 h-10 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
}

export function TrackingPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white shadow-sm">
        <div className="w-full px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200"></div>
                <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0"></div>
                <div>
                   <div className="flex items-center gap-2 mb-2">
                      <div className="h-5 w-32 bg-gray-200 rounded"></div>
                      <div className="h-4 w-20 bg-gray-200 rounded-full"></div>
                   </div>
                   <div className="h-3 w-40 bg-gray-200 rounded"></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export function OrderDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm animate-pulse">
        <div className="w-full px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
              <div>
                <div className="h-5 w-40 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-32 bg-gray-200 rounded"></div>
              </div>
            </div>
            <div className="h-6 w-24 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
      <div className="bg-white border-t border-gray-100 animate-pulse">
        <div className="w-full px-4 pb-4 pt-3">
          <div className="flex items-center gap-2 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className="w-8 h-8 rounded-full bg-gray-200 mb-1"></div>
                  <div className="h-3 w-16 bg-gray-200 rounded"></div>
                </div>
                {i < 5 && (
                  <div className="h-0.5 w-10 sm:w-16 mx-1 bg-gray-200"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrdersPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section Skeleton */}
      <div className="bg-white shadow-sm mb-4">
        <div className="w-full px-2.5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>

      <div className="w-full px-2.5 py-4">
        {/* Search and Filter Skeleton */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 animate-pulse">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 h-10 bg-gray-200 rounded-lg"></div>
            <div className="lg:w-1/2 h-10 bg-gray-200 rounded-lg"></div>
          </div>
        </div>

        {/* Orders List Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
