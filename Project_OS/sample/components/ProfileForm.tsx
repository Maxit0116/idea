'use client'

import { useState } from 'react'

interface Props {
  user: { id: string; name: string; email: string } | null
}

export default function ProfileForm({ user }: Props) {
  const [name, setName] = useState(user?.name ?? '')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: user?.email }),
    })
    setSaved(true)
  }

  return (
    <div>
      <label>
        Name
        <input value={name} onChange={e => setName(e.target.value)} />
      </label>
      <p>Email: {user?.email}</p>
      <button onClick={handleSave}>Save</button>
      {saved && <p>Saved!</p>}
    </div>
  )
}
