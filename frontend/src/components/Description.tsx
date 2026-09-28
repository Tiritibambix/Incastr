import { useEffect, useRef, useState } from 'react'

interface Props {
  text: string
  /** Classes for color/size/spacing, applied to the text itself (e.g. "text-gray-400 text-sm mt-2"). */
  className?: string
}

export default function Description({ text, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [text])

  return (
    <div>
      <p ref={ref} className={`whitespace-pre-line ${expanded ? '' : 'line-clamp-3'} ${className}`}>
        {text}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-accent hover:text-accent-hover"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
