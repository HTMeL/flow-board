import { useState } from 'react'
import type { Card as CardType, ColumnId } from '../types'
import Card from './Card'

interface Props {
  id: ColumnId
  label: string
  cards: CardType[]
  onDropCard: (cardId: string, column: ColumnId, refocus?: boolean) => void
  onEditCard: (card: CardType) => void
  onDeleteCard: (id: string) => void
  onAddCard: (column: ColumnId) => void
  filtered: boolean
}

export default function Column({
  id,
  label,
  cards,
  onDropCard,
  onEditCard,
  onDeleteCard,
  onAddCard,
  filtered,
}: Props) {
  const [isOver, setIsOver] = useState(false)

  return (
    <section
      className={`column${isOver ? ' over' : ''}`}
      aria-labelledby={`col-${id}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setIsOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsOver(false)
        const cardId = e.dataTransfer.getData('text/plain')
        if (cardId && !cards.some((c) => c.id === cardId)) onDropCard(cardId, id)
      }}
    >
      <div className="column-header">
        <h2 className="column-title" id={`col-${id}`}>
          {label}{' '}
          <span className="count">
            {cards.length}
            <span className="sr-only"> cards</span>
          </span>
        </h2>
        <button
          className="btn small"
          onClick={() => onAddCard(id)}
          aria-label={`Add card to ${label}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="column-cards">
        {cards.length === 0 && (
          <p className="empty">{filtered ? 'No matching cards' : 'Drop cards here'}</p>
        )}
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onEdit={() => onEditCard(card)}
            onDelete={() => onDeleteCard(card.id)}
            onMove={(column) => onDropCard(card.id, column, true)}
          />
        ))}
      </div>
    </section>
  )
}
