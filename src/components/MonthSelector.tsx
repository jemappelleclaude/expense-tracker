import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

interface Props {
  year: number
  month: number // 0-indexed
  onChange: (year: number, month: number) => void
}

export function MonthSelector({ year, month, onChange }: Props) {
  function prev() {
    if (month === 0) onChange(year - 1, 11)
    else onChange(year, month - 1)
  }
  function next() {
    if (month === 11) onChange(year + 1, 0)
    else onChange(year, month + 1)
  }

  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <button
        onClick={prev}
        className="p-2 rounded-xl hover:bg-accent active:bg-accent/70 transition-colors text-muted-foreground"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="font-semibold text-sm select-none tracking-wide">
        {format(new Date(year, month), 'MMMM yyyy')}
      </span>
      <button
        onClick={next}
        className="p-2 rounded-xl hover:bg-accent active:bg-accent/70 transition-colors text-muted-foreground"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
