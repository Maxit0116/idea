import { AdminTable } from '@/components/AdminTable'
import { fetchAllUsers } from '@/lib/data'
import { SearchBar } from '@/components/ui/SearchBar'

export const metadata = { title: 'Manage Users' }

export default async function AdminUsersPage() {
  const users = await fetchAllUsers()
  return (
    <div className="admin-users">
      <h1>User Management</h1>
      <SearchBar placeholder="Search users..." />
      <AdminTable data={users} columns={['name', 'email', 'role', 'joined']} />
    </div>
  )
}
