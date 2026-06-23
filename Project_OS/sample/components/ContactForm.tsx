'use client'

import { useState } from 'react'
import { validateEmail } from '@/lib/validators'

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    if (!validateEmail(email)) return
    setStatus('sending')
    await fetch('/api/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) })
    setStatus('sent')
  }

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <input name="name" placeholder="Your name" required />
      <input name="email" type="email" placeholder="Email" required />
      <textarea name="message" placeholder="Message" rows={5} required />
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sent' ? 'Sent!' : status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}
