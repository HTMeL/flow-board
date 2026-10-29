import { useEffect, useRef, useState } from 'react'
import { COLUMNS, PRIORITIES } from '../types'
import type { Card as CardType, CardInput, ColumnId, Priority } from '../types'
import { loadCards, newId, MAX_IMPORT_BYTES, parseCards, saveCards, STORAGE_KEY } from '../storage'
import Column from './Column'
import CardModal from './CardModal'
import Toast from './Toast'

const UNDO_MS = 10000

// null = closed, 'new' = creating, CardType = editing
type ModalState = null | 'new' | CardType

export default function Board() {
  const [cards, setCards] = useState<CardType[]>(loadCards)
  const [modal, setModal] = useState<ModalState>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [deleted, setDeleted] = useState<{ card: CardType; index: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [newColumn, setNewColumn] = useState<ColumnId>('backlog')
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const undoTimer = useRef<number>(undefined)
  const pendingFocus = useRef<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSaveFailed(!saveCards(cards))
  }, [cards])

  // keep keyboard focus from dropping to <body> when the focused element is replaced
  useEffect(() => {
    if (!pendingFocus.current) return
    document.querySelector<HTMLElement>(pendingFocus.current)?.focus()
    pendingFocus.current = null
  }, [cards])

  useEffect(() => () => window.clearTimeout(undoTimer.current), [])

  // pick up changes made in other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return
      const next = parseCards(e.newValue)
      if (next) setCards(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const openNew = (column: ColumnId = 'backlog') => {
    setNewColumn(column)
    setModal('new')
  }

  const exportCards = () => {
    const blob = new Blob([JSON.stringify(cards, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flow-board.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importCards = async (file: File) => {
    const imported = file.size > MAX_IMPORT_BYTES ? null : parseCards(await file.text())
    if (!imported) {
      setAnnouncement('Import failed: not a Flow Board file')
      window.alert('That file is not a valid Flow Board export.')
      return
    }
    if (!window.confirm(`Replace the current board with ${imported.length} imported cards?`)) return
    setCards(imported)
    setAnnouncement(`Imported ${imported.length} cards`)
  }

  // "N" opens the new-card dialog unless the user is typing or a dialog is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return
      if (modal) return
      const t = e.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || t.isContentEditable) return
      e.preventDefault()
      openNew()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal])

  const saveCard = (input: CardInput) => {
    if (modal === 'new') {
      setCards((prev) => [
        ...prev,
        { ...input, id: newId(), column: newColumn },
      ])
      const label = COLUMNS.find((c) => c.id === newColumn)?.label
      setAnnouncement(`Added "${input.title}" to ${label}`)
    } else if (modal) {
      const id = modal.id
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...input } : c)))
    }
    setModal(null)
  }

  const deleteCard = (id: string) => {
    const index = cards.findIndex((c) => c.id === id)
    if (index === -1) return
    setDeleted({ card: cards[index], index })
    setAnnouncement(`Deleted "${cards[index].title}"`)
    setCards((prev) => prev.filter((c) => c.id !== id))
    setModal(null)
    pendingFocus.current = '.toast .btn'
    startUndoTimer()
  }

  const startUndoTimer = () => {
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setDeleted(null), UNDO_MS)
  }

  const undoDelete = () => {
    if (!deleted) return
    const { card, index } = deleted
    setCards((prev) => [...prev.slice(0, index), card, ...prev.slice(index)])
    setDeleted(null)
    setAnnouncement(`Restored "${card.title}"`)
    pendingFocus.current = `[data-card-id="${card.id}"]`
    window.clearTimeout(undoTimer.current)
  }

  const moveCard = (id: string, column: ColumnId, refocus = false) => {
    if (refocus) pendingFocus.current = `[data-card-id="${id}"]`
    const moved = cards.find((c) => c.id === id)
    if (moved && moved.column !== column) {
      const label = COLUMNS.find((c) => c.id === column)?.label
      setAnnouncement(`Moved "${moved.title}" to ${label}`)
    }
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, column } : c)))
  }

  const q = query.trim().toLowerCase()
  const filtered = q !== '' || priorityFilter !== ''
  const visible = cards.filter(
    (c) =>
      (!priorityFilter || c.priority === priorityFilter) &&
      (!q || c.title.toLowerCase().includes(q) || c.assignee.toLowerCase().includes(q)),
  )

  return (
    <div className="app">
      <a className="skip-link" href="#board">
        Skip to board
      </a>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      <header className="app-header">
        <h1>Flow Board</h1>
        <div className="header-tools">
          <input
            type="search"
            className="search"
            placeholder="Search title or assignee"
            aria-label="Search cards"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="filter-select"
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button className="btn" onClick={exportCards}>
            Export
          </button>
          <button className="btn" onClick={() => importRef.current?.click()}>
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importCards(file)
              e.target.value = ''
            }}
          />
          <button className="btn primary" onClick={() => openNew()}>
            + Add card <kbd>N</kbd>
          </button>
        </div>
      </header>
      {saveFailed && (
        <p className="banner" role="alert">
          Changes can't be saved in this browser. They'll be lost when you close or reload the page.
        </p>
      )}
      <main className="board" id="board" tabIndex={-1}>
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            id={col.id}
            label={col.label}
            cards={visible.filter((c) => c.column === col.id)}
            onDropCard={moveCard}
            onEditCard={setModal}
            onDeleteCard={deleteCard}
            onAddCard={openNew}
            filtered={filtered}
          />
        ))}
      </main>
      {deleted && <Toast
          message={`Deleted "${deleted.card.title}"`}
          onUndo={undoDelete}
          onPause={() => window.clearTimeout(undoTimer.current)}
          onResume={startUndoTimer}
        />}
      {modal && (
        <CardModal
          card={modal === 'new' ? null : modal}
          onSave={saveCard}
          onDelete={deleteCard}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
