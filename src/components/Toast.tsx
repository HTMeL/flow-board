interface Props {
  message: string
  onUndo: () => void
  onPause: () => void
  onResume: () => void
}

// The timer pauses while the pointer or keyboard focus is on the toast (WCAG 2.2.1).
export default function Toast({ message, onUndo, onPause, onResume }: Props) {
  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      <span>{message}</span>
      <button className="btn small" onClick={onUndo}>
        Undo
      </button>
    </div>
  )
}
