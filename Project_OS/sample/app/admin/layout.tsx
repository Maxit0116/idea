import { requireAdmin } from '@/lib/auth'
import { AdminNav } from '@/components/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="admin-layout">
      <AdminNav />
      <main className="admin-content">{children}</main>
    </div>
  )
}
