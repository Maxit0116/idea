import { fetchAnalytics } from '@/lib/data'
import { ChartContainer } from '@/components/ui/ChartContainer'

export const metadata = { title: 'Analytics' }

export default async function AnalyticsPage() {
  const data = await fetchAnalytics()
  return (
    <div className="analytics-page">
      <h1>Analytics</h1>
      <ChartContainer data={data.timeSeries} title="Growth Over Time" />
      <ChartContainer data={data.revenue} title="Revenue Breakdown" />
    </div>
  )
}
