import { useId, useState } from 'react'
import { COLUMNS } from '../types'
import type { Card as CardType, ColumnId } from '../types'

interface Props {
  card: CardType
  onEdit: () => void
  onDelete: () => void
  onMove: (column: ColumnId) => void // from the move buttons
}

function formatDate(iso: string): string {
  if (!iso) return 'No due date'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dueStatus(card: CardType): 'overdue' | 'soon' | null {
  if (!card.dueDate || card.column === 'done') return null
  const now = new Date()
  const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
  if (card.dueDate < localISO(now)) return 'overdue'
  if (card.dueDate <= localISO(soon)) return 'soon'
  return null
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d={dir === 'left' ? 'M10 6H2M5 3 2 6l3 3' : 'M2 6h8M7 3l3 3-3 3'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Card({ card, onEdit, onDelete, onMove }: Props) {
  const [dragging, setDragging] = useState(false)
  const status = dueStatus(card)
  const headingId = useId()
  const colIndex = COLUMNS.findIndex((c) => c.id === card.column)
  const prev = COLUMNS[colIndex - 1]
  const next = COLUMNS[colIndex + 1]

  return (
    <article
      className={`card${dragging ? ' dragging' : ''}`}
      data-card-id={card.id}
      aria-labelledby={headingId}
      draggable
      tabIndex={0}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id)
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onKeyDown={(e) => {
        // only when the card itself is focused, not its buttons or select
        if (e.key === 'Enter' && e.target === e.currentTarget) {
          // stop the same keypress from submitting the dialog's auto-focused form
          e.preventDefault()
          onEdit()
        }
      }}
      onDoubleClick={onEdit}
    >
      <div className="card-top">
        <h3 className="card-title" id={headingId}>{card.title}</h3>
        <span className={`badge ${card.priority.toLowerCase()}`}>{card.priority}</span>
      </div>
      <p className="card-meta">{card.assignee || 'Unassigned'}</p>
      <p className={`card-meta${status ? ` due-${status}` : ''}`}>
        Due {formatDate(card.dueDate)}
        {status === 'overdue' && ' · Overdue'}
        {status === 'soon' && ' · Due soon'}
      </p>
      <div className="card-actions">
        <button
          className="btn small"
          disabled={!prev}
          onClick={() => prev && onMove(prev.id)}
          aria-label={prev ? `Move "${card.title}" to ${prev.label}` : `"${card.title}" is in the first column`}
        >
          <Arrow dir="left" />
        </button>
        <button
          className="btn small"
          disabled={!next}
          onClick={() => next && onMove(next.id)}
          aria-label={next ? `Move "${card.title}" to ${next.label}` : `"${card.title}" is in the last column`}
        >
          <Arrow dir="right" />
        </button>
        <button className="btn small" onClick={onEdit} aria-label={`Edit "${card.title}"`}>
          Edit
        </button>
        <button
          className="btn small danger"
          onClick={onDelete}
          aria-label={`Delete "${card.title}"`}
        >
          Delete
        </button>
      </div>
    </article>
  )
}
