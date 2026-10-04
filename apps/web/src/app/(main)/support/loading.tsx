export default function SupportLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-12" aria-busy="true" aria-label="Loading support tickets">
      <div className="bg-white border-b border-gray-200">
        <div className="w-full px-[10px]">
          <div className="py-6 flex justify-between items-center">
            <div>
              <div className="h-7 w-44 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-4 w-64 bg-gray-100 rounded mt-2 animate-pulse" />
            </div>
            <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
      <div className="w-full px-[10px] py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-8 w-16 bg-gray-200 rounded mt-2" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="h-5 w-32 bg-gray-200 rounded" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="px-6 py-4 border-b border-gray-100 last:border-0 flex items-center gap-4">
              <div className="h-5 w-20 bg-gray-200 rounded-full" />
              <div className="h-4 flex-1 bg-gray-100 rounded" />
              <div className="h-4 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
