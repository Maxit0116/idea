'use client'

import { useEffect, useState } from 'react'
import { BlogCard } from '@/components/BlogCard'

export function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<{ users: any[]; posts: any[] }>({ users: [], posts: [] })

  useEffect(() => {
    fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json()).then(setResults)
  }, [query])

  return (
    <div className="search-results">
      {results.posts.length > 0 && (
        <section>
          <h2>Posts ({results.posts.length})</h2>
          {results.posts.map((p: any) => (
            <BlogCard key={p.id} post={p} />
          ))}
        </section>
      )}
      {results.users.length > 0 && (
        <section>
          <h2>Users ({results.users.length})</h2>
          {results.users.map((u: any) => (
            <div key={u.id}>{u.name}</div>
          ))}
        </section>
      )}
    </div>
  )
}
