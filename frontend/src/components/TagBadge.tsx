interface Props {
  name: string
  onRemove?: () => void
}

export default function TagBadge({ name, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 text-indigo-500 hover:text-indigo-700 leading-none">
          ×
        </button>
      )}
    </span>
  )
}
