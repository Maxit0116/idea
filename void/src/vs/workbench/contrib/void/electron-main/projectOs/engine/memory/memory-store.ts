import * as fs from 'fs/promises'
import * as path from 'path'
import type { MemoryEntry, MemoryCategory, MemoryStore } from '../../../../common/projectOsTypes.js'

export class FileMemoryStore implements MemoryStore {
  private entries = new Map<string, MemoryEntry>()
  private writeLock: Promise<unknown> = Promise.resolve()
  private dirty = false

  constructor(private readonly storePath: string) {}

  private withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeLock.then(fn, fn)
    this.writeLock = next.catch(() => undefined)
    return next
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.storePath, 'utf-8')
      const data = JSON.parse(raw) as MemoryEntry[]
      this.entries.clear()
      for (const entry of data) {
        this.entries.set(entry.slug, entry)
      }
    } catch {
      this.entries.clear()
    }
  }

  private async persist(): Promise<void> {
    if (!this.dirty) return
    const dir = path.dirname(this.storePath)
    await fs.mkdir(dir, { recursive: true })
    const data = Array.from(this.entries.values())
    await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf-8')
    this.dirty = false
  }

  async list(category?: MemoryCategory): Promise<MemoryEntry[]> {
    const all = Array.from(this.entries.values())
    if (!category) return all
    return all.filter(e => e.category === category)
  }

  async get(slug: string): Promise<MemoryEntry | null> {
    return this.entries.get(slug) ?? null
  }

  upsert(slug: string, body: string, category: MemoryCategory, nodeId?: string | null): Promise<void> {
    return this.withWriteLock(async () => {
      const now = new Date().toISOString()
      const existing = this.entries.get(slug)
      this.entries.set(slug, {
        slug,
        body,
        category,
        nodeId: nodeId ?? existing?.nodeId ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      this.dirty = true
      await this.persist()
    })
  }

  remove(slug: string): Promise<void> {
    return this.withWriteLock(async () => {
      if (this.entries.delete(slug)) {
        this.dirty = true
        await this.persist()
      }
    })
  }

  async listByNode(nodeId: string): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values()).filter(e => e.nodeId === nodeId)
  }

  async renderContext(nodeId?: string): Promise<string> {
    const sections: string[] = []

    const projectMemory = await this.list('project')
    if (projectMemory.length > 0) {
      sections.push('<project_memory>')
      for (const m of projectMemory) {
        sections.push(`## ${m.slug}\n${m.body}`)
      }
      sections.push('</project_memory>')
    }

    if (nodeId) {
      const nodeMemory = await this.listByNode(nodeId)
      if (nodeMemory.length > 0) {
        sections.push('<node_memory>')
        for (const m of nodeMemory) {
          sections.push(`## ${m.slug}\n${m.body}`)
        }
        sections.push('</node_memory>')
      }
    }

    const sessionMemory = await this.list('session')
    if (sessionMemory.length > 0) {
      sections.push('<session_insight>')
      for (const m of sessionMemory) {
        sections.push(`- ${m.body}`)
      }
      sections.push('</session_insight>')
    }

    return sections.join('\n\n')
  }
}
