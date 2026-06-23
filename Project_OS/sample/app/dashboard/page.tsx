import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getStats } from '@/lib/data'
import StatsCard from '@/components/StatsCard'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const stats = await getStats(session.userId)

  return (
    <div>
      <h1>Dashboard</h1>
      <div>
        <StatsCard title="Users" value={stats.userCount} />
        <StatsCard title="Revenue" value={stats.revenue} />
        <StatsCard title="Active Plans" value={stats.activePlans} />
      </div>
    </div>
  )
}
