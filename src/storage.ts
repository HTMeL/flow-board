import { COLUMNS, PRIORITIES } from './types'
import type { Card } from './types'

export const STORAGE_KEY = 'flow-board:cards'
const BACKUP_KEY = 'flow-board:cards:backup'

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.assignee === 'string' &&
    typeof c.dueDate === 'string' &&
    PRIORITIES.includes(c.priority as Card['priority']) &&
    COLUMNS.some((col) => col.id === c.column)
  )
}

export const MAX_TITLE = 120
export const MAX_ASSIGNEE = 60
export const MAX_IMPORT_BYTES = 1_000_000
const MAX_CARDS = 2000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Returns null when the text isn't a card array. Invalid entries are dropped, and each
// kept card is rebuilt from known fields only so unexpected data never gets stored.
export function parseCards(raw: string): Card[] | null {
  if (raw.length > MAX_IMPORT_BYTES) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const seen = new Set<string>()
    const cards: Card[] = []
    for (const item of parsed.slice(0, MAX_CARDS)) {
      if (!isCard(item) || seen.has(item.id)) continue
      if (item.dueDate !== '' && !DATE_RE.test(item.dueDate)) continue
      seen.add(item.id)
      cards.push({
        id: item.id.slice(0, 64),
        title: item.title.slice(0, MAX_TITLE),
        assignee: item.assignee.slice(0, MAX_ASSIGNEE),
        priority: item.priority,
        dueDate: item.dueDate,
        column: item.column,
      })
    }
    return cards
  } catch {
    return null
  }
}

function sampleCards(): Card[] {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return [
    {
      id: newId(),
      title: 'Welcome! Drag me to another column',
      assignee: 'You',
      priority: 'Medium',
      dueDate,
      column: 'backlog',
    },
  ]
}

// First run gets a sample card; unreadable data is stashed under a backup key, not lost.
export function loadCards(): Card[] {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return []
  }
  if (raw === null) return sampleCards()
  const cards = parseCards(raw)
  if (cards) return cards
  try {
    localStorage.setItem(BACKUP_KEY, raw)
  } catch {
    // nothing more we can do
  }
  return []
}

// Returns false when the write fails (storage unavailable or full).
export function saveCards(cards: Card[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
    return true
  } catch {
    return false
  }
}

// crypto.randomUUID is only available in secure contexts (not http://<lan-ip>).
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
