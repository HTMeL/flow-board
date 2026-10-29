import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Card from './Card'
import { isoDate, makeCard } from '../test/utils'

const noop = () => {}
const renderCard = (over = {}) => render(<Card card={makeCard(over)} onEdit={noop} onDelete={noop} onMove={vi.fn()} />)

describe('card accessibility (audit: WCAG 4.1.2, 2.5.3, 2.5.7)', () => {
  it('is a focusable article named by its own title', () => {
    renderCard({ title: 'Ship it' })
    const article = screen.getByRole('article', { name: 'Ship it' })
    expect(article).toHaveAttribute('tabindex', '0')
  })

  it('gives every action a card-specific name', () => {
    renderCard({ title: 'Ship it', column: 'in-progress' })
    expect(screen.getByRole('button', { name: 'Edit "Ship it"' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete "Ship it"' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move "Ship it" to Backlog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Move "Ship it" to In Review' })).toBeInTheDocument()
  })

  it('uses icon-only arrows (no text that could mismatch the accessible name)', () => {
    renderCard({ title: 'T', column: 'in-progress' })
    const arrow = screen.getByRole('button', { name: 'Move "T" to In Review' })
    expect(arrow).toHaveTextContent('')
    expect(arrow.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has no <select> that changes the column on input (WCAG 3.2.2)', () => {
    renderCard()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('calls onMove with the neighbouring column', () => {
    const onMove = vi.fn()
    render(<Card card={makeCard({ column: 'in-progress', title: 'M' })} onEdit={noop} onDelete={noop} onMove={onMove} />)
    screen.getByRole('button', { name: 'Move "M" to In Review' }).click()
    screen.getByRole('button', { name: 'Move "M" to Backlog' }).click()
    expect(onMove.mock.calls).toEqual([['in-review'], ['backlog']])
  })
})

describe('due status', () => {
  it('shows text, not just colour, for overdue and soon (WCAG 1.4.1)', () => {
    const { unmount } = renderCard({ dueDate: isoDate(-1) })
    expect(screen.getByText(/Overdue/)).toBeInTheDocument()
    unmount()
    renderCard({ dueDate: isoDate(2) })
    expect(screen.getByText(/Due soon/)).toBeInTheDocument()
  })

  it('treats today as due soon, not overdue', () => {
    renderCard({ dueDate: isoDate(0) })
    const article = screen.getByRole('article')
    expect(within(article).queryByText(/Overdue/)).toBeNull()
    expect(within(article).getByText(/Due soon/)).toBeInTheDocument()
  })

  it('falls back gracefully when there is no due date or assignee', () => {
    renderCard({ dueDate: '', assignee: '' })
    expect(screen.getByText('Due No due date')).toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })
})
