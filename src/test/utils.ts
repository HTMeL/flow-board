import { STORAGE_KEY } from '../storage'
import type { Card } from '../types'

let n = 0
export function makeCard(over: Partial<Card> = {}): Card {
  n += 1
  return {
    id: `card-${n}`,
    title: `Task ${n}`,
    assignee: 'Sam',
    priority: 'Medium',
    dueDate: '2099-01-01',
    column: 'backlog',
    ...over,
  }
}

export function seed(cards: Card[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function stored(): Card[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
}

export function isoDate(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
