import { SearchBar } from '@/components/ui/SearchBar'
import { SearchResults } from '@/components/SearchResults'

export const metadata = { title: 'Search' }

export default function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <main className="search-page">
      <h1>Search</h1>
      <SearchBar placeholder="Search everything..." defaultValue={searchParams.q} />
      {searchParams.q && <SearchResults query={searchParams.q} />}
    </main>
  )
}
