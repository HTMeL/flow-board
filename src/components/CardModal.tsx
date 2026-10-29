import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PRIORITIES } from '../types'
import { MAX_ASSIGNEE, MAX_TITLE } from '../storage'
import type { Card, CardInput, Priority } from '../types'

interface Props {
  card: Card | null
  onSave: (input: CardInput) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function CardModal({ card, onSave, onDelete, onClose }: Props) {
  const titleId = useId()
  const formRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const assigneeRef = useRef<HTMLInputElement>(null)
  const errorIdBase = useId()

  // Captured during the first render, before autoFocus moves focus into the dialog.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  // restore focus to the opener on close; lock background scroll while open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [opener])

  const trapFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !formRef.current) return
    const focusable = formRef.current.querySelectorAll<HTMLElement>(
      'input, select, button, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const [title, setTitle] = useState(card?.title ?? '')
  const [assignee, setAssignee] = useState(card?.assignee ?? '')
  const [priority, setPriority] = useState<Priority>(card?.priority ?? 'Medium')
  const [dueDate, setDueDate] = useState(card?.dueDate ?? '')

  const [errors, setErrors] = useState<{ title?: string; assignee?: string }>({})

  const dirty =
    title !== (card?.title ?? '') ||
    assignee !== (card?.assignee ?? '') ||
    priority !== (card?.priority ?? 'Medium') ||
    dueDate !== (card?.dueDate ?? '')

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your changes?')) return
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = {
      title: title.trim() ? '' : 'Title is required',
      assignee: assignee.trim() ? '' : 'Assignee is required',
    }
    if (next.title || next.assignee) {
      setErrors({ title: next.title || undefined, assignee: next.assignee || undefined })
      ;(next.title ? titleRef : assigneeRef).current?.focus()
      return
    }
    onSave({ title: title.trim(), assignee: assignee.trim(), priority, dueDate })
  }

  return (
    <div className="overlay" onMouseDown={requestClose}>
      <div
        className="modal"
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') requestClose()
          trapFocus(e)
        }}
      >
        <form className="modal-form" onSubmit={submit}>
        <h2 id={titleId}>{card ? 'Edit card' : 'New card'}</h2>
        <p className="req-note">* Required field</p>
        <label>
          <span>
            Title <span aria-hidden="true">*</span>
          </span>
          <input
            ref={titleRef}
            aria-describedby={errors.title ? `${errorIdBase}-title` : undefined}
            autoFocus
            required
            maxLength={MAX_TITLE}
            aria-invalid={!!errors.title}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {errors.title && <span className="field-error" id={`${errorIdBase}-title`}>{errors.title}</span>}
        </label>
        <label>
          <span>
            Assignee <span aria-hidden="true">*</span>
          </span>
          <input
            ref={assigneeRef}
            aria-describedby={errors.assignee ? `${errorIdBase}-assignee` : undefined}
            required
            maxLength={MAX_ASSIGNEE}
            aria-invalid={!!errors.assignee}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          />
          {errors.assignee && <span className="field-error" id={`${errorIdBase}-assignee`}>{errors.assignee}</span>}
        </label>
        <label>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Due date <span aria-hidden="true">*</span>
          </span>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          {card && (
            <button
              type="button"
              className="btn danger"
              onClick={() => onDelete(card.id)}
            >
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}
