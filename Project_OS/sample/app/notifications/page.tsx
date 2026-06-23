import { NotificationList } from '@/components/NotificationList'
import { getCurrentUser } from '@/lib/auth'

export const metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const user = await getCurrentUser()
  return (
    <main className="notifications-page">
      <h1>Notifications</h1>
      <NotificationList userId={user.id} />
    </main>
  )
}
