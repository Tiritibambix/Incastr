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
        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <select
        value={field}
        onChange={(e) => setField(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <button
        type="submit"
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Search
      </button>
    </form>
  )
}
