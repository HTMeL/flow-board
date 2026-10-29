import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Board from './Board'
import { isoDate, makeCard, seed, stored } from '../test/utils'
import { STORAGE_KEY } from '../storage'

const user = () => userEvent.setup()
const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`, 'i') })

async function fillAndSave(u: ReturnType<typeof user>, title: string, assignee: string) {
  const dialog = screen.getByRole('dialog')
  await u.type(within(dialog).getByLabelText(/^title/i), title)
  await u.type(within(dialog).getByLabelText(/^assignee/i), assignee)
  fireEvent.change(within(dialog).getByLabelText(/^due date/i), { target: { value: '2030-05-01' } })
  await u.click(within(dialog).getByRole('button', { name: 'Save' }))
}

describe('creating cards', () => {
  it('creates a card in Backlog and persists it', async () => {
    seed([])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: /^\+ add card/i }))
    await fillAndSave(u, 'Write docs', 'Kim')

    expect(within(column('Backlog')).getByText('Write docs')).toBeInTheDocument()
    expect(stored()).toMatchObject([{ title: 'Write docs', assignee: 'Kim', column: 'backlog', priority: 'Medium' }])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('adds to the chosen column from its + button', async () => {
    seed([])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: 'Add card to Done' }))
    await fillAndSave(u, 'Shipped', 'Lee')
    expect(within(column('Done')).getByText('Shipped')).toBeInTheDocument()
  })

  it('opens the new-card dialog with the N shortcut, but not while typing', async () => {
    seed([])
    const u = user()
    render(<Board />)
    await u.keyboard('n')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await u.type(screen.getByLabelText(/^title/i), 'n')
    expect(screen.getByLabelText(/^title/i)).toHaveValue('n')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('seeds a welcome card on first run and does not reseed after deleting it', async () => {
    const u = user()
    const { unmount } = render(<Board />)
    expect(screen.getByText(/welcome/i)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /delete "welcome/i }))
    unmount()
    render(<Board />)
    expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument()
  })
})

describe('editing cards', () => {
  it('edits via the Edit button and keeps the card in its column', async () => {
    const c = makeCard({ title: 'Old', column: 'in-review' })
    seed([c])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: 'Edit "Old"' }))
    const title = screen.getByLabelText(/^title/i)
    await u.clear(title)
    await u.type(title, 'New')
    await u.selectOptions(within(screen.getByRole('dialog')).getByLabelText(/priority/i), 'High')
    await u.click(screen.getByRole('button', { name: 'Save' }))

    expect(within(column('In Review')).getByText('New')).toBeInTheDocument()
    expect(stored()[0]).toMatchObject({ id: c.id, title: 'New', priority: 'High', column: 'in-review' })
  })

  it('opens edit on double-click and on Enter when the card itself is focused', async () => {
    seed([makeCard({ title: 'Dbl' })])
    const u = user()
    render(<Board />)
    await u.dblClick(screen.getByRole('article', { name: 'Dbl' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await u.keyboard('{Escape}')
    screen.getByRole('article', { name: 'Dbl' }).focus()
    await u.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('pressing Enter on a card button does not also open the edit dialog', async () => {
    seed([makeCard({ title: 'Btn', column: 'backlog' })])
    const u = user()
    render(<Board />)
    screen.getByRole('button', { name: 'Move "Btn" to In Progress' }).focus()
    await u.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('moving cards', () => {
  it('moves with the arrow buttons, announces it and keeps keyboard focus on the card', async () => {
    const c = makeCard({ title: 'Mover', column: 'backlog' })
    seed([c])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: 'Move "Mover" to In Progress' }))

    expect(within(column('In Progress')).getByText('Mover')).toBeInTheDocument()
    expect(stored()[0].column).toBe('in-progress')
    expect(screen.getByText('Moved "Mover" to In Progress')).toBeInTheDocument()
    expect(document.activeElement).toHaveAttribute('data-card-id', c.id) // audit: WCAG 2.4.3
  })

  it('disables the arrows at the first and last column', () => {
    seed([makeCard({ title: 'First', column: 'backlog' }), makeCard({ title: 'Last', column: 'done' })])
    render(<Board />)
    expect(screen.getByRole('button', { name: /"First" is in the first column/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /"Last" is in the last column/ })).toBeDisabled()
  })

  it('moves a card when dropped on another column', () => {
    const c = makeCard({ title: 'Dragged', column: 'backlog' })
    seed([c])
    render(<Board />)
    fireEvent.drop(column('Done'), { dataTransfer: { getData: () => c.id } })
    expect(within(column('Done')).getByText('Dragged')).toBeInTheDocument()
    expect(stored()[0].column).toBe('done')
  })

  it('ignores a drop onto the column the card is already in', () => {
    const c = makeCard({ column: 'backlog' })
    seed([c])
    render(<Board />)
    fireEvent.drop(column('Backlog'), { dataTransfer: { getData: () => c.id } })
    expect(screen.queryByText(/^Moved/)).not.toBeInTheDocument()
  })

  it('shows a dragging style while dragging', () => {
    seed([makeCard({ title: 'Drag me' })])
    render(<Board />)
    const card = screen.getByRole('article', { name: 'Drag me' })
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    expect(card).toHaveClass('dragging')
    fireEvent.dragEnd(card)
    expect(card).not.toHaveClass('dragging')
  })
})

describe('deleting cards (audit: undo)', () => {
  it('deletes, shows an undo toast, and focuses Undo', async () => {
    seed([makeCard({ title: 'Doomed' })])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: 'Delete "Doomed"' }))

    expect(screen.queryByText('Doomed', { selector: 'h3' })).not.toBeInTheDocument()
    expect(stored()).toEqual([])
    expect(screen.getByRole('status')).toHaveTextContent('Deleted "Doomed"')
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
  })

  it('undo restores the card at its original position and focuses it', async () => {
    const a = makeCard({ title: 'A' })
    const b = makeCard({ title: 'B' })
    const c = makeCard({ title: 'C' })
    seed([a, b, c])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: 'Delete "B"' }))
    await u.click(screen.getByRole('button', { name: 'Undo' }))

    expect(stored().map((x) => x.title)).toEqual(['A', 'B', 'C'])
    expect(document.activeElement).toHaveAttribute('data-card-id', b.id)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('deletes from inside the edit dialog', async () => {
    seed([makeCard({ title: 'FromModal' })])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: 'Edit "FromModal"' }))
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stored()).toEqual([])
  })

  describe('undo toast timing (WCAG 2.2.1)', () => {
    async function deleteOne() {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      seed([makeCard({ title: 'Timed' })])
      const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Board />)
      await u.click(screen.getByRole('button', { name: 'Delete "Timed"' }))
      return u
    }
    const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

    it('pauses while focus is on the toast (Undo is focused after a delete)', async () => {
      await deleteOne()
      advance(60000)
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('disappears after 10 seconds once focus leaves, not earlier', async () => {
      await deleteOne()
      act(() => (document.activeElement as HTMLElement).blur())
      advance(9000)
      expect(screen.getByRole('status')).toBeInTheDocument() // the old 5s limit would have expired
      advance(1500)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('pauses while hovered and resumes afterwards', async () => {
      const u = await deleteOne()
      act(() => (document.activeElement as HTMLElement).blur())
      await u.hover(screen.getByRole('status'))
      advance(60000)
      expect(screen.getByRole('status')).toBeInTheDocument()
      await u.unhover(screen.getByRole('status'))
      advance(10500)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })
})

describe('search and filter', () => {
  it('filters by text and priority and shows an empty message', async () => {
    seed([
      makeCard({ title: 'Alpha', assignee: 'Sam', priority: 'High' }),
      makeCard({ title: 'Beta', assignee: 'Ana', priority: 'Low' }),
    ])
    const u = user()
    render(<Board />)
    await u.type(screen.getByLabelText('Search cards'), 'ana')
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()

    await u.clear(screen.getByLabelText('Search cards'))
    await u.selectOptions(screen.getByLabelText('Filter by priority'), 'High')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
    expect(within(column('Done')).getByText('No matching cards')).toBeInTheDocument()
  })

  it('shows a drop hint in empty columns when not filtering', () => {
    seed([])
    render(<Board />)
    expect(within(column('Backlog')).getByText('Drop cards here')).toBeInTheDocument()
  })
})

describe('due dates', () => {
  it('flags overdue and due-soon cards, but never cards in Done', () => {
    seed([
      makeCard({ title: 'Late', dueDate: isoDate(-2) }),
      makeCard({ title: 'Soon', dueDate: isoDate(1) }),
      makeCard({ title: 'Far', dueDate: isoDate(30) }),
      makeCard({ title: 'Finished', dueDate: isoDate(-9), column: 'done' }),
    ])
    render(<Board />)
    expect(within(screen.getByRole('article', { name: 'Late' })).getByText(/Overdue/)).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Soon' })).getByText(/Due soon/)).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Far' })).queryByText(/Overdue|Due soon/)).toBeNull()
    expect(within(screen.getByRole('article', { name: 'Finished' })).queryByText(/Overdue/)).toBeNull()
  })
})

describe('persistence and resilience (audit: data safety)', () => {
  it('shows a banner when saving fails', () => {
    seed([])
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    render(<Board />)
    expect(screen.getByRole('alert')).toHaveTextContent(/can't be saved/i)
  })

  it('survives corrupt saved data without crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{{{')
    render(<Board />)
    expect(screen.getByRole('heading', { level: 1, name: 'Flow Board' })).toBeInTheDocument()
  })

  it('syncs changes from another tab', () => {
    seed([])
    render(<Board />)
    const c = makeCard({ title: 'From other tab' })
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify([c]) }))
    })
    expect(screen.getByText('From other tab')).toBeInTheDocument()
  })

  it('ignores invalid data arriving from another tab', () => {
    const c = makeCard({ title: 'Mine' })
    seed([c])
    render(<Board />)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'garbage' }))
    })
    expect(screen.getByText('Mine')).toBeInTheDocument()
  })
})

describe('import', () => {
  it('rejects invalid files without changing the board', async () => {
    const c = makeCard({ title: 'Keep me' })
    seed([c])
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    const u = user()
    const { container } = render(<Board />)
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    await u.upload(input, new File(['not json'], 'x.json', { type: 'application/json' }))
    await screen.findByText('Keep me')
    expect(window.alert).toHaveBeenCalled()
    expect(stored()).toEqual([c])
  })

  it('replaces the board after the user confirms a valid file', async () => {
    seed([makeCard({ title: 'Old' })])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const u = user()
    const { container } = render(<Board />)
    const imported = makeCard({ title: 'Imported' })
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    await u.upload(input, new File([JSON.stringify([imported])], 'b.json', { type: 'application/json' }))
    await screen.findByText('Imported')
    expect(screen.queryByText('Old')).not.toBeInTheDocument()
  })
})

describe('no real database access', () => {
  it('makes no network calls through a full create/edit/move/delete flow', async () => {
    seed([])
    const u = user()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: /^\+ add card/i }))
    await fillAndSave(u, 'Offline', 'Kim')
    await u.click(screen.getByRole('button', { name: 'Move "Offline" to In Progress' }))
    await u.click(screen.getByRole('button', { name: 'Delete "Offline"' }))
    expect(fetch).not.toHaveBeenCalled()
  })
})
