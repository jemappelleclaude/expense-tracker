import { useState, useEffect } from 'react'
import { db } from '@/lib/db'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (value: string) => void
  categoryId: number | null
  placeholder?: string
  maxLength?: number
  className?: string
}

export function NoteAutocomplete({ value, onChange, categoryId, placeholder, maxLength, className }: Props) {
  const [suggestions, setSuggestions] = useState<Array<{ id: number; text: string }>>([])

  useEffect(() => {
    if (value.length < 2) {
      setSuggestions([])
      return
    }

    const lower = value.toLowerCase()
    let cancelled = false

    db.savedNotes.toArray().then(all => {
      if (cancelled) return
      const filtered = all
        .filter(n => n.text.toLowerCase().includes(lower))
        .sort((a, b) => {
          const aCat = a.categoryId === categoryId ? 1 : 0
          const bCat = b.categoryId === categoryId ? 1 : 0
          if (bCat !== aCat) return bCat - aCat
          return b.usageCount - a.usageCount
        })
        .slice(0, 5)

      setSuggestions(filtered.map(n => ({ id: n.id!, text: n.text })))
    })

    return () => { cancelled = true }
  }, [value, categoryId])

  const hasSuggestions = suggestions.length > 0

  return (
    <div>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(className, hasSuggestions && 'rounded-b-none')}
      />
      {hasSuggestions && (
        <div className="border border-t-0 border-input rounded-b-xl overflow-hidden bg-background shadow-sm">
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onPointerDown={e => {
                e.preventDefault()
                onChange(s.text)
                setSuggestions([])
              }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted/50 active:bg-muted transition-colors truncate',
                i < suggestions.length - 1 && 'border-b border-border/40'
              )}
            >
              {s.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
