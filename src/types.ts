export type Priority = 'High' | 'Medium' | 'Low'

export type ColumnId = 'backlog' | 'in-progress' | 'in-review' | 'done'

export interface Card {
  id: string
  title: string
  assignee: string
  priority: Priority
  dueDate: string
  column: ColumnId
}

export type CardInput = Omit<Card, 'id' | 'column'>

export const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'in-review', label: 'In Review' },
  { id: 'done', label: 'Done' },
]

export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low']
