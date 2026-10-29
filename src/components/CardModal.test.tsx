import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Board from './Board'
import CardModal from './CardModal'
import { MAX_ASSIGNEE, MAX_TITLE } from '../storage'
import { makeCard, seed } from '../test/utils'

function setup(card = null as ReturnType<typeof makeCard> | null) {
  const props = { card, onSave: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() }
  render(<CardModal {...props} />)
  return props
}

describe('dialog semantics (audit: WCAG 4.1.2, 1.3.1)', () => {
  it('is a labelled modal dialog on a div, not on the form', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'New card' })
    expect(dialog.tagName).toBe('DIV')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.querySelector('form')).not.toBeNull()
  })

  it('hides the required asterisk from assistive tech and explains it', () => {
    setup()
    expect(screen.getByText('* Required field')).toBeInTheDocument()
    const stars = screen.getAllByText('*', { selector: 'span[aria-hidden=true]' })
    expect(stars).toHaveLength(3)
    expect(screen.getByLabelText(/^title/i)).toBeRequired()
    expect(screen.getByLabelText(/^assignee/i)).toBeRequired()
    expect(screen.getByLabelText(/^due date/i)).toBeRequired()
  })

  it('limits field lengths (audit: security)', () => {
    setup()
    expect(screen.getByLabelText(/^title/i)).toHaveAttribute('maxlength', String(MAX_TITLE))
    expect(screen.getByLabelText(/^assignee/i)).toHaveAttribute('maxlength', String(MAX_ASSIGNEE))
  })

  it('locks background scroll while open and restores it on unmount', () => {
    const { unmount } = render(<CardModal card={null} onSave={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('focus management (audit: WCAG 2.4.3, 2.1.2)', () => {
  it('autofocuses the title', () => {
    setup()
    expect(screen.getByLabelText(/^title/i)).toHaveFocus()
  })

  it('wraps Tab and Shift+Tab inside the dialog', async () => {
    const u = userEvent.setup()
    setup(makeCard())
    const dialog = screen.getByRole('dialog')
    const buttons = within(dialog).getAllByRole('button')
    buttons[buttons.length - 1].focus() // Save, the last control
    await u.tab()
    expect(screen.getByLabelText(/^title/i)).toHaveFocus()
    await u.tab({ shift: true })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveFocus()
  })

  it('returns focus to the control that opened it when closed', async () => {
    seed([makeCard({ title: 'Opener' })])
    const u = userEvent.setup()
    render(<Board />)
    const edit = screen.getByRole('button', { name: 'Edit "Opener"' })
    await u.click(edit)
    expect(screen.getByLabelText(/^title/i)).toHaveFocus()
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(edit).toHaveFocus() // regression: opener used to be captured after autofocus
  })

  it('does not restore focus to an element that no longer exists', async () => {
    seed([makeCard({ title: 'Gone' })])
    const u = userEvent.setup()
    render(<Board />)
    await u.click(screen.getByRole('button', { name: 'Edit "Gone"' }))
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus()
  })

  it('Enter on a focused card opens edit and stays open (regression: keypress submitted the form)', async () => {
    seed([makeCard({ title: 'Keyboard' })])
    const u = userEvent.setup()
    render(<Board />)
    screen.getByRole('article', { name: 'Keyboard' }).focus()
    await u.keyboard('{Enter}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Keyboard')
  })
})

describe('validation (audit: WCAG 3.3.1, 3.3.3)', () => {
  function bypassNativeRequired() {
    screen.getByRole('dialog').querySelectorAll('[required]').forEach((el) => el.removeAttribute('required'))
  }

  it('rejects whitespace-only title and assignee, links the errors and focuses the first invalid field', async () => {
    const u = userEvent.setup()
    const { onSave } = setup()
    await u.type(screen.getByLabelText(/^title/i), '   ')
    await u.type(screen.getByLabelText(/^assignee/i), '   ')
    bypassNativeRequired()
    await u.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).not.toHaveBeenCalled()
    const title = screen.getByLabelText(/^title/i)
    expect(title).toHaveFocus()
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription('Title is required')
    expect(screen.getByLabelText(/^assignee/i)).toHaveAccessibleDescription('Assignee is required')
  })

  it('focuses the assignee when only that field is invalid', async () => {
    const u = userEvent.setup()
    setup()
    await u.type(screen.getByLabelText(/^title/i), 'ok')
    await u.type(screen.getByLabelText(/^assignee/i), '  ')
    bypassNativeRequired()
    await u.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText(/^assignee/i)).toHaveFocus()
  })

  it('trims values on save', async () => {
    const u = userEvent.setup()
    const { onSave } = setup()
    await u.type(screen.getByLabelText(/^title/i), '  Padded  ')
    await u.type(screen.getByLabelText(/^assignee/i), ' Kim ')
    fireEvent.change(screen.getByLabelText(/^due date/i), { target: { value: '2030-01-02' } })
    await u.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ title: 'Padded', assignee: 'Kim', priority: 'Medium', dueDate: '2030-01-02' })
  })
})

describe('discarding changes (audit: data safety)', () => {
  it('closes without asking when nothing changed', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const u = userEvent.setup()
    const { onClose } = setup(makeCard())
    await u.keyboard('{Escape}')
    expect(confirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('asks before discarding edits from Esc, Cancel or the backdrop, and respects "no"', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const u = userEvent.setup()
    const { onClose } = setup()
    await u.type(screen.getByLabelText(/^title/i), 'x')
    await u.keyboard('{Escape}')
    await u.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.mouseDown(document.querySelector('.overlay')!)
    expect(confirm).toHaveBeenCalledTimes(3)
    expect(onClose).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await u.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a click inside the dialog does not count as a backdrop click', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
