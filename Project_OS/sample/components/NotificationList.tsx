'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

export function NotificationList({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/notifications').then((r) => r.json()).then(setNotifications)
  }, [userId])

  return (
    <div className="notification-list">
      {notifications.map((n: any) => (
        <div key={n.id} className={`notification ${n.read ? '' : 'unread'}`}>
          <p>{n.message}</p>
          <time>{formatDate(n.createdAt)}</time>
        </div>
      ))}
    </div>
  )
}
