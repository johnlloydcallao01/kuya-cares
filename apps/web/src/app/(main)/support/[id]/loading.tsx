export default function TicketLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-12" aria-busy="true" aria-label="Loading ticket thread">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="w-full px-[10px]">
          <div className="py-6 flex justify-between items-center">
            <div>
              <div className="h-7 w-40 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-4 w-56 bg-gray-100 rounded mt-2 animate-pulse" />
            </div>
            <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
      <div className="w-full px-[10px] py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="h-5 w-32 bg-gray-200 rounded" />
              </div>
              <div className="p-6 space-y-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`flex flex-col ${i % 2 ? 'items-end' : 'items-start'}`}>
                    <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
                    <div className="h-16 w-3/4 bg-gray-100 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse space-y-4">
              <div className="h-5 w-28 bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
              <div className="h-4 w-1/2 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
