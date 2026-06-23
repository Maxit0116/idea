import Link from 'next/link'

export default function Sidebar() {
  return (
    <nav style={{ width: 240, borderRight: '1px solid #eee', padding: 16 }}>
      <h2>SaaS Starter</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li><Link href="/dashboard">Dashboard</Link></li>
        <li><Link href="/profile">Profile</Link></li>
        <li><Link href="/settings">Settings</Link></li>
      </ul>
    </nav>
  )
}
