import { BlogCard } from '@/components/BlogCard'
import { fetchPosts } from '@/lib/data'

export const metadata = { title: 'Blog' }

export default async function BlogPage() {
  const posts = await fetchPosts()
  return (
    <main className="blog-page">
      <h1>Blog</h1>
      <div className="post-grid">
        {posts.map((post: any) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
    </main>
  )
}
