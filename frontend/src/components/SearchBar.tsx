import { useState } from 'react'

interface Props {
  onSearch: (q: string, field: string) => void
}

const FIELDS = [
  { value: '', label: 'All fields' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'category', label: 'Category' },
  { value: 'tags', label: 'Tags' },
]

export default function SearchBar({ onSearch }: Props) {
  const [q, setQ] = useState('')
  const [field, setField] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(q, field)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search videos..."
        className="flex-1 px-3 py-2 bg-surface-raised border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <select
        value={field}
        onChange={(e) => setField(e.target.value)}
        className="px-3 py-2 bg-surface-raised border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <button
        type="submit"
        className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover"
      >
        Search
      </button>
    </form>
  )
}
