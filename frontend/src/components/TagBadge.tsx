interface Props {
  name: string
  onRemove?: () => void
}

export default function TagBadge({ name, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-soft text-accent">
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 text-accent hover:text-accent-hover leading-none">
          ×
        </button>
      )}
    </span>
  )
}
