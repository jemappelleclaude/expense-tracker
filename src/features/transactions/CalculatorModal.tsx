import { useState, useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

function safeEval(expr: string): number | 'divzero' | null {
  const s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '')
  if (!s) return null

  const tokens: (number | string)[] = []
  let cur = ''

  for (const ch of s) {
    if ('+-*/'.includes(ch)) {
      if (cur !== '') {
        const n = parseFloat(cur)
        if (isNaN(n)) return null
        tokens.push(n)
        cur = ''
      } else if (!tokens.length) {
        continue
      } else if (typeof tokens[tokens.length - 1] === 'string') {
        tokens[tokens.length - 1] = ch
        continue
      }
      tokens.push(ch)
    } else {
      cur += ch
    }
  }
  if (cur !== '') {
    const n = parseFloat(cur)
    if (isNaN(n)) return null
    tokens.push(n)
  }

  while (tokens.length && typeof tokens[tokens.length - 1] === 'string') tokens.pop()
  if (!tokens.length) return null
  if (tokens.length === 1) return tokens[0] as number

  const arr = [...tokens]
  let i = 1
  while (i < arr.length) {
    if (arr[i] === '*' || arr[i] === '/') {
      const l = arr[i - 1] as number
      const r = arr[i + 1] as number
      if (arr[i] === '/' && r === 0) return 'divzero'
      arr.splice(i - 1, 3, arr[i] === '*' ? l * r : l / r)
    } else {
      i += 2
    }
  }

  let res = arr[0] as number
  i = 1
  while (i < arr.length) {
    const op = arr[i] as string
    const r = arr[i + 1] as number
    res = op === '+' ? res + r : res - r
    i += 2
  }
  return res
}

interface Props {
  open: boolean
  onClose: () => void
  onUse: (v: number) => void
  initialValue?: string
}

export function CalculatorModal({ open, onClose, onUse, initialValue }: Props) {
  const [expression, setExpression] = useState('')
  const [current, setCurrent] = useState('')
  const [justEvaled, setJustEvaled] = useState(false)
  const [evalExpr, setEvalExpr] = useState('')

  // Reset state each time the modal opens
  useEffect(() => {
    if (!open) return
    const n = parseFloat(initialValue ?? '')
    setExpression('')
    setCurrent(!isNaN(n) && n > 0 ? n.toString() : '')
    setJustEvaled(false)
    setEvalExpr('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const fullExpr = expression + current
  const raw = safeEval(fullExpr)

  let error: string | null = null
  let result: number | null = null

  if (raw === 'divzero') {
    error = 'Cannot divide by zero'
  } else if (raw !== null) {
    const r = Math.round(raw * 100) / 100
    if (r < 0) error = 'Amount must be positive'
    else result = r
  }

  const hasExpr = expression.length > 0
  const largeDisplay = error
    ? error
    : result !== null && hasExpr
      ? result.toLocaleString('en-IN', { maximumFractionDigits: 2 })
      : current || '0'

  const exprLine = justEvaled ? evalExpr : expression.trimEnd()
  const finalValue = error ? null : result
  const canUse = finalValue !== null && finalValue > 0

  function digit(d: string) {
    if (justEvaled) {
      setEvalExpr('')
      setExpression('')
      setCurrent(d === '.' ? '0.' : d)
      setJustEvaled(false)
      return
    }
    if (d === '.' && current.includes('.')) return
    if (current.replace('.', '').length >= 10) return
    setCurrent(p => {
      if (d === '.') return p === '' ? '0.' : p + '.'
      if (p === '0') return d
      return p + d
    })
  }

  function operator(op: string) {
    setJustEvaled(false)
    setEvalExpr('')
    if (!current && !expression) return
    if (current) {
      setExpression(p => p + current + ' ' + op + ' ')
      setCurrent('')
    } else {
      setExpression(p => {
        const t = p.trimEnd()
        if (['+', '-', '×', '÷'].includes(t.slice(-1))) {
          return t.slice(0, -1).trimEnd() + ' ' + op + ' '
        }
        return p + op + ' '
      })
    }
  }

  function equal() {
    if (!fullExpr) return
    const res = safeEval(fullExpr)
    if (res === null || res === 'divzero') return
    const rounded = Math.round((res as number) * 100) / 100
    setEvalExpr(fullExpr + ' =')
    setExpression('')
    setCurrent(rounded.toString())
    setJustEvaled(true)
  }

  function backspace() {
    if (justEvaled) {
      setEvalExpr('')
      setExpression('')
      setCurrent('')
      setJustEvaled(false)
      return
    }
    if (current) {
      setCurrent(p => p.slice(0, -1))
      return
    }
    if (!expression) return
    const parts = expression.trimEnd().split(' ').filter(Boolean)
    if (!parts.length) return
    const last = parts[parts.length - 1]
    if (['+', '-', '×', '÷'].includes(last)) {
      parts.pop()
      const prev = parts[parts.length - 1]
      if (prev && !isNaN(+prev)) {
        parts.pop()
        setCurrent(prev)
      }
    }
    setExpression(parts.length ? parts.join(' ') + ' ' : '')
  }

  function clear() {
    setExpression('')
    setCurrent('')
    setJustEvaled(false)
    setEvalExpr('')
  }

  const useLabel = canUse && finalValue
    ? `Use ₹${finalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : 'Enter an amount'

  const opActive = (op: string) =>
    expression.endsWith(op + ' ') && !current && !justEvaled

  const numBtn =
    'flex items-center justify-center font-semibold text-lg rounded-2xl bg-muted/80 text-foreground active:scale-95 transition-transform select-none touch-manipulation'
  const opBtn = (op: string) =>
    cn(
      'flex items-center justify-center font-semibold text-xl rounded-2xl active:scale-95 transition-transform select-none touch-manipulation',
      opActive(op) ? 'bg-violet-500 text-white' : 'bg-violet-500/20 text-violet-400',
    )

  return (
    // Nested DialogPrimitive.Root registers this in Radix's DismissableLayer stack,
    // which prevents the outer Sheet's react-remove-scroll from blocking touch events here.
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-[100] bg-black/50',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'duration-300',
          )}
        />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'fixed bottom-0 left-1/2 -translate-x-1/2 z-[101]',
            'w-full max-w-[430px]',
            'bg-card border-t border-border/40 rounded-t-3xl pt-2',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full',
            'duration-300 focus:outline-none',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Calculator</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Enter a calculation to set the transaction amount
          </DialogPrimitive.Description>

          {/* Drag handle */}
          <div className="flex justify-center pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm font-semibold">Calculator</span>
            <DialogPrimitive.Close className="rounded-full p-1.5 hover:bg-accent text-muted-foreground transition-colors touch-manipulation">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Display */}
          <div className="px-5 pb-3 flex flex-col items-end gap-0.5 min-h-[68px] justify-end">
            <div className="text-xs text-muted-foreground font-mono truncate w-full text-right h-4 leading-4">
              {exprLine}
            </div>
            <div
              className={cn(
                'font-mono font-bold text-right w-full truncate leading-tight',
                error ? 'text-sm text-red-400' : 'text-3xl text-foreground',
              )}
            >
              {largeDisplay}
            </div>
          </div>

          {/* Numpad */}
          <div
            className="px-3"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(5, 48px)',
              gap: '8px',
            }}
          >
            {/* Row 1 */}
            <button onClick={clear} className="flex items-center justify-center font-semibold text-lg rounded-2xl bg-red-500/20 text-red-400 active:scale-95 transition-transform select-none touch-manipulation">
              C
            </button>
            <button onClick={backspace} className="flex items-center justify-center font-semibold text-xl rounded-2xl bg-muted/80 text-muted-foreground active:scale-95 transition-transform select-none touch-manipulation">
              ⌫
            </button>
            <button onClick={() => operator('÷')} className={opBtn('÷')}>÷</button>
            <button onClick={() => operator('×')} className={opBtn('×')}>×</button>

            {/* Row 2 */}
            <button onClick={() => digit('7')} className={numBtn}>7</button>
            <button onClick={() => digit('8')} className={numBtn}>8</button>
            <button onClick={() => digit('9')} className={numBtn}>9</button>
            <button onClick={() => operator('-')} className={opBtn('-')}>−</button>

            {/* Row 3 */}
            <button onClick={() => digit('4')} className={numBtn}>4</button>
            <button onClick={() => digit('5')} className={numBtn}>5</button>
            <button onClick={() => digit('6')} className={numBtn}>6</button>
            <button onClick={() => operator('+')} className={opBtn('+')}>+</button>

            {/* Row 4 */}
            <button onClick={() => digit('1')} className={numBtn}>1</button>
            <button onClick={() => digit('2')} className={numBtn}>2</button>
            <button onClick={() => digit('3')} className={numBtn}>3</button>

            {/* = spans rows 4–5, col 4 */}
            <button
              onClick={equal}
              style={{ gridRow: '4 / 6', gridColumn: '4' }}
              className="flex items-center justify-center font-bold text-2xl rounded-2xl bg-violet-500 text-white active:scale-95 transition-transform select-none touch-manipulation"
            >
              =
            </button>

            {/* Row 5 */}
            <button
              onClick={() => digit('0')}
              style={{ gridColumn: '1 / 3' }}
              className={numBtn}
            >
              0
            </button>
            <button onClick={() => digit('.')} className={numBtn}>.</button>
            {/* col 4 occupied by = */}
          </div>

          {/* Use button */}
          <div className="px-3 pt-3 pb-6">
            <button
              onClick={() => { if (canUse && finalValue) onUse(finalValue) }}
              disabled={!canUse}
              className={cn(
                'w-full h-12 rounded-2xl font-semibold text-base transition-all touch-manipulation',
                canUse
                  ? 'gradient-primary text-white shadow-lg shadow-violet-500/30 active:scale-[0.98]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              {useLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
