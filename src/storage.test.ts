import { describe, expect, it, vi } from 'vitest'
import { loadCards, MAX_ASSIGNEE, MAX_IMPORT_BYTES, MAX_TITLE, newId, parseCards, saveCards, STORAGE_KEY } from './storage'
import { makeCard } from './test/utils'

describe('parseCards (audit: import hardening)', () => {
  it('accepts valid cards', () => {
    const c = makeCard()
    expect(parseCards(JSON.stringify([c]))).toEqual([c])
  })

  it('returns null for non-arrays and invalid JSON', () => {
    expect(parseCards('{"a":1}')).toBeNull()
    expect(parseCards('not json')).toBeNull()
  })

  it('drops cards with a bad priority, column or missing fields', () => {
    const good = makeCard()
    const raw = JSON.stringify([
      good,
      { ...makeCard(), priority: 'Urgent' },
      { ...makeCard(), column: 'archive' },
      { id: 'x', title: 'no other fields' },
      null,
      'string',
    ])
    expect(parseCards(raw)).toEqual([good])
  })

  it('drops malformed due dates but allows an empty one', () => {
    const empty = makeCard({ dueDate: '' })
    const raw = JSON.stringify([empty, makeCard({ dueDate: 'tomorrow' }), makeCard({ dueDate: '2030-1-1' })])
    expect(parseCards(raw)).toEqual([empty])
  })

  it('removes duplicate ids, keeping the first', () => {
    const a = makeCard({ id: 'dup', title: 'first' })
    const b = makeCard({ id: 'dup', title: 'second' })
    expect(parseCards(JSON.stringify([a, b]))).toEqual([a])
  })

  it('rebuilds cards from known fields only', () => {
    const raw = JSON.stringify([{ ...makeCard(), __proto__: { x: 1 }, isAdmin: true, extra: '<script>' }])
    const [card] = parseCards(raw)!
    expect(Object.keys(card).sort()).toEqual(['assignee', 'column', 'dueDate', 'id', 'priority', 'title'])
  })

  it('truncates over-long fields', () => {
    const [card] = parseCards(
      JSON.stringify([makeCard({ title: 'x'.repeat(MAX_TITLE + 50), assignee: 'y'.repeat(MAX_ASSIGNEE + 50) })]),
    )!
    expect(card.title).toHaveLength(MAX_TITLE)
    expect(card.assignee).toHaveLength(MAX_ASSIGNEE)
  })

  it('rejects files over the size cap and caps the card count', () => {
    expect(parseCards(' '.repeat(MAX_IMPORT_BYTES + 1))).toBeNull()
    const many = Array.from({ length: 2100 }, () => makeCard())
    expect(parseCards(JSON.stringify(many))).toHaveLength(2000)
  })
})

describe('loadCards (audit: data safety)', () => {
  it('seeds a welcome card on first run', () => {
    const cards = loadCards()
    expect(cards).toHaveLength(1)
    expect(cards[0].column).toBe('backlog')
  })

  it('stays empty when an empty board was saved', () => {
    localStorage.setItem(STORAGE_KEY, '[]')
    expect(loadCards()).toEqual([])
  })

  it('keeps unreadable data under a backup key instead of destroying it', () => {
    localStorage.setItem(STORAGE_KEY, '{corrupt')
    expect(loadCards()).toEqual([])
    expect(localStorage.getItem('flow-board:cards:backup')).toBe('{corrupt')
  })

  it('filters invalid cards instead of crashing', () => {
    const good = makeCard()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([good, { id: 'bad', priority: null }]))
    expect(loadCards()).toEqual([good])
  })

  it('returns [] when storage itself throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadCards()).toEqual([])
  })
})

describe('saveCards', () => {
  it('reports success and failure', () => {
    expect(saveCards([makeCard()])).toBe(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveCards([])).toBe(false)
  })
})

describe('newId (audit: insecure-context fallback)', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' })
    expect(newId()).toBe('uuid-1')
  })

  it('falls back to unique ids when randomUUID is missing', () => {
    vi.stubGlobal('crypto', {})
    const ids = new Set(Array.from({ length: 50 }, newId))
    expect(ids.size).toBe(50)
  })
})
