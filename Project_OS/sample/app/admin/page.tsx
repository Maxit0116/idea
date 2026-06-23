import { StatsCard } from '@/components/StatsCard'
import { fetchAnalytics } from '@/lib/data'

export const metadata = { title: 'Admin Dashboard' }

export default async function AdminPage() {
  const stats = await fetchAnalytics()
  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div className="stats-grid">
        <StatsCard title="Users" value={stats.users} />
        <StatsCard title="Revenue" value={stats.revenue} />
        <StatsCard title="Posts" value={stats.posts} />
      </div>
    </div>
  )
}
