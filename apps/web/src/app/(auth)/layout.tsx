/**
 * Auth Layout - Clean layout for authentication pages
 * No header, sidebar, or footer - just the auth content
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
