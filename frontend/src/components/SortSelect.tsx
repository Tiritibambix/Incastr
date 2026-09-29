export const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'duration_desc', label: 'Longest first' },
  { value: 'duration_asc', label: 'Shortest first' },
  { value: 'title_asc', label: 'Title (A-Z)' },
] as const

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
}

export default function SortSelect({ value, onChange, className = '' }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-[42px] px-3 py-2 bg-surface-raised border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent ${className}`}
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
