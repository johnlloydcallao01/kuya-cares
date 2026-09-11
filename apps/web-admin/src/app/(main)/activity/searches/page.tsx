import ActivityPage from '../ActivityPage'
import { ClientOnly } from '@/components/ClientOnly'

function SearchesSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="p-4 space-y-3 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

export default function RecentSearchesPage() {
  return (
    <ClientOnly fallback={<SearchesSkeleton />}>
      <ActivityPage activity="searches" />
    </ClientOnly>
  )
}
