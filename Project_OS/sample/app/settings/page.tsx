import { getSession } from '@/lib/auth'
import { getUserSettings } from '@/lib/db'
import { redirect } from 'next/navigation'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const settings = await getUserSettings(session.userId)

  return (
    <div>
      <h1>Settings</h1>
      <form>
        <label>
          Email Notifications
          <input type="checkbox" defaultChecked={settings.emailNotifications} />
        </label>
        <label>
          Theme
          <select defaultValue={settings.theme}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <button type="submit">Save</button>
      </form>
    </div>
  )
}
