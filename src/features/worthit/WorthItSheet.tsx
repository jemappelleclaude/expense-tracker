import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Clock, ShoppingCart, AlertCircle, Sparkles, Settings } from 'lucide-react'
import { formatDistanceToNow, addHours, addDays } from 'date-fns'
import { db, type PendingPurchase } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function hourlyRate(monthlySalary: number, weeklyHours: number) {
  return (monthlySalary * 12) / (weeklyHours * 52)
}

function workContext(hours: number, weeklyHours: number) {
  const daily = weeklyHours / 5
  if (hours < 1 / 6)       return { color: '#22c55e', tint: 'green',  msg: 'Barely a dent — under 10 minutes of work' }
  if (hours < 1)            return { color: '#22c55e', tint: 'green',  msg: 'Quick win — less than an hour of work' }
  if (hours < daily * 0.5)  return { color: '#f59e0b', tint: 'yellow', msg: `About ${Math.round(hours)} hour${Math.round(hours) !== 1 ? 's' : ''} of work` }
  if (hours < daily)        return { color: '#f97316', tint: 'orange', msg: `That's most of a workday` }
  if (hours < weeklyHours) {
    const days = (hours / daily).toFixed(1)
    return { color: '#ef4444', tint: 'red', msg: `That's ${days} full workdays` }
  }
  const weeks = (hours / weeklyHours).toFixed(1)
  return { color: '#ef4444', tint: 'red', msg: `That's over ${weeks} full work week${parseFloat(weeks) > 1.5 ? 's' : ''}!` }
}

function formatWorkTime(hours: number) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const R = 66, CIRC = 2 * Math.PI * R

function WorkRing({ hours, dailyHours, color }: { hours: number; dailyHours: number; color: string }) {
  const fraction = Math.min(hours / dailyHours, 1)
  const offset   = CIRC * (1 - fraction)

  return (
    <div className="relative flex items-center justify-center">
      <svg viewBox="0 0 160 160" className="w-44 h-44 -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="currentColor"
          strokeWidth="12" className="text-muted" />
        <circle cx="80" cy="80" r={R} fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-3xl font-bold tabular-nums leading-none" style={{ color }}>
          {formatWorkTime(hours)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1 tracking-wide uppercase">of work</p>
        {hours > dailyHours && (
          <p className="text-[10px] font-semibold mt-0.5" style={{ color }}>
            {(hours / dailyHours).toFixed(1)}× workday
          </p>
        )}
      </div>
    </div>
  )
}

function PendingRow({ item, onBuy, onSkip }: {
  item: PendingPurchase
  onBuy: () => void
  onSkip: () => void
}) {
  const now     = new Date()
  const expired = new Date(item.decideBefore) <= now
  const timeLeft = expired
    ? "Time's up!"
    : formatDistanceToNow(new Date(item.decideBefore), { addSuffix: true })

  return (
    <div className={cn(
      'rounded-2xl border p-4 flex flex-col gap-3',
      expired ? 'bg-red-500/8 border-red-500/25' : 'bg-card border-border/60'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums mt-0.5">{formatCurrency(item.price)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold text-muted-foreground">
            {formatWorkTime(item.workHours)} of work
          </p>
          <p className={cn('text-[11px] font-medium mt-0.5', expired ? 'text-red-400' : 'text-muted-foreground')}>
            {timeLeft}
          </p>
        </div>
      </div>
      {expired && (
        <p className="text-xs font-bold text-red-400 text-center">Time's up — still want it?</p>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-red-400 border-red-400/30 hover:bg-red-400/10 rounded-xl"
          onClick={onSkip}
        >
          Skip
        </Button>
        <Button
          size="sm"
          className="flex-1 rounded-xl gradient-primary border-0 text-white shadow-md shadow-violet-500/20"
          onClick={onBuy}
        >
          Buy It
        </Button>
      </div>
    </div>
  )
}

const DURATIONS = [
  { label: '24h',    fn: () => addHours(new Date(), 24) },
  { label: '48h',    fn: () => addHours(new Date(), 48) },
  { label: '3 days', fn: () => addDays(new Date(), 3)   },
  { label: '7 days', fn: () => addDays(new Date(), 7)   },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBuyIt: (amount: number, note: string, categoryId?: number) => void
}

type View = 'evaluate' | 'pending'

export default function WorthItSheet({ open, onOpenChange, onBuyIt }: Props) {
  const navigate = useNavigate()

  const [view, setView]           = useState<View>('evaluate')
  const [itemName, setItemName]   = useState('')
  const [price, setPrice]         = useState('')
  const [thinking, setThinking]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [skipFlash, setSkipFlash] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)

  const settings = useLiveQuery(async () => {
    const salary = await db.userSettings.get('monthlySalary')
    const hours  = await db.userSettings.get('weeklyHours')
    return {
      monthlySalary: salary?.value as number | undefined,
      weeklyHours:   (hours?.value as number | undefined) ?? 40,
    }
  }, [])

  const pending = useLiveQuery(
    () => db.pendingPurchases.where('status').equals('pending').toArray(),
    []
  )

  useEffect(() => {
    if (!open) { setView('evaluate'); setThinking(false); setSkipFlash(false) }
    else       { setItemName(''); setPrice('') }
  }, [open])

  useEffect(() => {
    if (open && view === 'evaluate') {
      setTimeout(() => nameRef.current?.focus(), 100)
    }
  }, [open, view])

  const parsedPrice = parseFloat(price) || 0

  const calc = useMemo(() => {
    if (!settings?.monthlySalary || parsedPrice <= 0) return null
    const rate  = hourlyRate(settings.monthlySalary, settings.weeklyHours)
    const hours = parsedPrice / rate
    const daily = settings.weeklyHours / 5
    const ctx   = workContext(hours, settings.weeklyHours)
    return { hours, daily, rate, ...ctx }
  }, [parsedPrice, settings])

  const shoppingCatId = useLiveQuery(async () => {
    const cat = await db.categories.filter(c => c.name === 'Shopping' && c.type === 'expense').first()
    return cat?.id
  }, [])

  const hasSettings  = !!settings?.monthlySalary
  const canEvaluate  = parsedPrice > 0
  const pendingCount = pending?.length ?? 0

  function handleBuyIt() {
    if (parsedPrice <= 0) return
    onBuyIt(parsedPrice, itemName.trim(), shoppingCatId)
    onOpenChange(false)
  }

  async function handleSkip() {
    if (parsedPrice <= 0) { onOpenChange(false); return }
    setSaving(true)
    try {
      const now = new Date()
      await db.pendingPurchases.add({
        name:         itemName.trim() || 'Item',
        price:        parsedPrice,
        workHours:    calc?.hours ?? 0,
        createdAt:    now,
        decideBefore: now,
        status:       'skipped',
      })
    } finally { setSaving(false) }
    setSkipFlash(true)
    setTimeout(() => { setSkipFlash(false); onOpenChange(false) }, 800)
  }

  async function handleThinkAboutIt(decideBefore: Date) {
    if (parsedPrice <= 0) return
    setSaving(true)
    try {
      await db.pendingPurchases.add({
        name:         itemName.trim() || 'Item',
        price:        parsedPrice,
        workHours:    calc?.hours ?? 0,
        createdAt:    new Date(),
        decideBefore,
        status:       'pending',
      })
    } finally { setSaving(false); setThinking(false) }
    onOpenChange(false)
  }

  async function handlePendingBuy(item: PendingPurchase) {
    await db.pendingPurchases.update(item.id!, { status: 'bought' })
    onBuyIt(item.price, item.name, shoppingCatId)
  }

  async function handlePendingSkip(item: PendingPurchase) {
    await db.pendingPurchases.update(item.id!, { status: 'skipped' })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        hideDragHandle
        className="h-dvh rounded-none overflow-hidden"
      >

        {/* ── Tab bar header ── */}
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
          <div className="flex flex-1 rounded-2xl bg-muted/60 p-1 gap-1">
            <button
              onClick={() => setView('evaluate')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
                view === 'evaluate'
                  ? 'gradient-primary text-white shadow-md shadow-violet-500/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Calculator
            </button>
            <button
              onClick={() => setView('pending')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all',
                view === 'pending'
                  ? 'gradient-primary text-white shadow-md shadow-violet-500/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              Pending{pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          </div>
          <SheetClose className="flex-shrink-0 rounded-full p-1.5 hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </SheetClose>
        </div>

        {/* ── Pending list view ── */}
        {view === 'pending' && (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4 flex flex-col gap-3 pt-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
              Think About It items
            </p>
            {pendingCount === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-8">No pending items.</p>
            )}
            {(pending ?? []).map(item => (
              <PendingRow
                key={item.id}
                item={item}
                onBuy={() => handlePendingBuy(item)}
                onSkip={() => handlePendingSkip(item)}
              />
            ))}
          </div>
        )}

        {/* ── No salary configured ── */}
        {view === 'evaluate' && !hasSettings && (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
            <div>
              <p className="font-bold text-lg">Salary not configured</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Set your monthly salary and weekly hours so we can calculate how many hours of work each purchase costs you.
              </p>
            </div>
            <Button
              onClick={() => { onOpenChange(false); navigate('/settings') }}
              className="w-full max-w-xs h-12 text-base rounded-xl gradient-primary border-0 text-white shadow-lg shadow-violet-500/30"
            >
              <Settings className="h-4 w-4 mr-2" />
              Go to Settings
            </Button>
          </div>
        )}

        {/* ── Evaluate view ── */}
        {view === 'evaluate' && hasSettings && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-2 flex flex-col gap-5 pt-4">

              {/* Item name */}
              <Input
                ref={nameRef}
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                placeholder="What is it? (e.g. Nike Shoes)"
                maxLength={80}
                className="text-base h-12 rounded-xl"
              />

              {/* Price input */}
              <div className="flex items-center gap-2 px-4 py-4 rounded-2xl bg-muted/30">
                <span className="text-2xl font-bold text-muted-foreground flex-shrink-0">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="0"
                  className={cn(
                    'min-w-0 flex-1 text-4xl font-bold bg-transparent border-none outline-none',
                    'placeholder:text-muted-foreground/30',
                    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                  )}
                  style={canEvaluate && calc ? { color: calc.color } : undefined}
                />
              </div>

              {/* Work cost display */}
              {canEvaluate && calc && (
                <div className={cn(
                  'flex flex-col items-center gap-4 rounded-2xl border py-6 px-4 transition-colors',
                  calc.tint === 'green'  && 'bg-emerald-500/8 border-emerald-500/20',
                  calc.tint === 'yellow' && 'bg-yellow-500/8  border-yellow-500/20',
                  calc.tint === 'orange' && 'bg-orange-500/8  border-orange-500/20',
                  calc.tint === 'red'    && 'bg-red-500/8     border-red-500/20',
                )}>
                  <WorkRing hours={calc.hours} dailyHours={calc.daily} color={calc.color} />
                  <div className="text-center">
                    <p className="font-bold text-sm" style={{ color: calc.color }}>{calc.msg}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      at {formatCurrency(Math.round(calc.rate))}/hr · {formatWorkTime(calc.hours)} total
                    </p>
                    {calc.hours > calc.daily && (
                      <p className="text-xs font-semibold text-red-400 mt-2">
                        That's {(calc.hours / calc.daily).toFixed(1)} full workdays of effort
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Think About It duration picker */}
              {thinking && (
                <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4">
                  <p className="text-sm font-semibold text-center text-muted-foreground">
                    Come back and decide in…
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {DURATIONS.map(d => (
                      <button
                        key={d.label}
                        onClick={() => handleThinkAboutIt(d.fn())}
                        disabled={saving}
                        className="py-3 rounded-xl border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary text-sm font-semibold transition-all active:scale-95"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setThinking(false)}
                    className="text-xs text-muted-foreground text-center py-1 hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Pinned footer */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-border/60 flex flex-col gap-2">
              {skipFlash ? (
                <div className="h-12 flex items-center justify-center">
                  <p className="text-emerald-500 font-bold text-sm">✓ Saved — good call!</p>
                </div>
              ) : !thinking ? (
                <>
                  <Button
                    onClick={handleBuyIt}
                    disabled={!canEvaluate || saving}
                    className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-500/20 border-0"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Buy It
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setThinking(true)}
                      disabled={!canEvaluate || saving}
                      className="flex-1 h-11 text-sm rounded-xl border-violet-400/40 text-violet-400 hover:bg-violet-400/10"
                    >
                      🤔 Think About It
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSkip}
                      disabled={saving}
                      className="flex-1 h-11 text-sm rounded-xl border-red-400/40 text-red-400 hover:bg-red-400/10"
                    >
                      ❌ Skip
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}

      </SheetContent>
    </Sheet>
  )
}
