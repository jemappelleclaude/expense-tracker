import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Trash2 } from 'lucide-react'
import { db, type RecurringRule, type TransactionType, type RecurrenceFrequency } from '@/lib/db'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toInputDate(d: Date | string): string {
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const FREQ_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly'  },
]

const TYPE_STYLES: Record<TransactionType, { active: string; amount: string }> = {
  expense:  { active: 'bg-red-500/15 text-red-400',    amount: 'text-red-400'   },
  income:   { active: 'bg-green-500/15 text-green-500', amount: 'text-green-500' },
  transfer: { active: 'bg-blue-500/15 text-blue-400',   amount: 'text-blue-400'  },
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: RecurringRule
}

export default function RecurringSheet({ open, onOpenChange, rule }: Props) {
  const isEditMode = !!rule

  const [type,        setType]        = useState<TransactionType>('expense')
  const [amount,      setAmount]      = useState('')
  const [categoryId,  setCategoryId]  = useState<number | null>(null)
  const [accountId,   setAccountId]   = useState<number | null>(null)
  const [toAccountId, setToAccountId] = useState<number | null>(null)
  const [frequency,   setFrequency]   = useState<RecurrenceFrequency>('monthly')
  const [startDate,   setStartDate]   = useState(todayString)
  const [endDate,     setEndDate]     = useState('')
  const [note,        setNote]        = useState('')
  const [saving,      setSaving]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const accounts   = useLiveQuery(() => db.accounts.toArray(), [])

  const visibleCategories = (categories ?? []).filter(c =>
    c.type === (type === 'transfer' ? 'expense' : type)
  )

  useEffect(() => {
    if (!open) { setConfirmDelete(false); return }
    if (rule) {
      const t = rule.transactionTemplate
      setType(t.type)
      setAmount(t.amount.toString())
      setCategoryId(t.type !== 'transfer' ? t.categoryId : null)
      setAccountId(t.accountId)
      setToAccountId(t.toAccountId ?? null)
      setNote(t.note)
      setFrequency(rule.frequency)
      setStartDate(toInputDate(rule.nextDate))
      setEndDate(rule.endDate ? toInputDate(rule.endDate) : '')
    } else {
      setType('expense')
      setAmount('')
      setCategoryId(null)
      setToAccountId(null)
      setFrequency('monthly')
      setStartDate(todayString())
      setEndDate('')
      setNote('')
    }
  }, [open, rule?.id])

  useEffect(() => {
    if (open && accountId === null && accounts?.length) {
      setAccountId((accounts.find(a => a.isDefault) ?? accounts[0]).id!)
    }
  }, [open, accountId, accounts])

  useEffect(() => {
    if (toAccountId !== null && toAccountId === accountId) setToAccountId(null)
  }, [accountId, toAccountId])

  function handleTypeChange(t: TransactionType) {
    if (t === type) return
    setType(t)
    setCategoryId(null)
  }

  const parsedAmount = parseFloat(amount)
  const isValid =
    !isNaN(parsedAmount) && parsedAmount > 0 &&
    accountId !== null &&
    startDate.length > 0 &&
    (type === 'transfer'
      ? toAccountId !== null && toAccountId !== accountId
      : categoryId !== null)

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    try {
      const nextDate = new Date(startDate + 'T00:00:00')
      const endDateObj = endDate ? new Date(endDate + 'T00:00:00') : undefined

      const template = {
        type,
        amount:      parsedAmount,
        categoryId:  type === 'transfer' ? 0 : categoryId!,
        accountId:   accountId!,
        toAccountId: type === 'transfer' ? toAccountId! : undefined,
        note:        note.trim(),
      }

      if (rule) {
        await db.recurringRules.put({ ...rule, transactionTemplate: template, frequency, nextDate, endDate: endDateObj })
      } else {
        await db.recurringRules.add({ transactionTemplate: template, frequency, nextDate, endDate: endDateObj })
      }
      onOpenChange(false)
    } catch (err) {
      console.error('Save rule failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!rule) return
    setSaving(true)
    try {
      await db.recurringRules.delete(rule.id!)
      onOpenChange(false)
    } catch (err) {
      console.error('Delete rule failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh]">

        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-base">{isEditMode ? 'Edit Recurring' : 'Add Recurring'}</h2>
          <SheetClose className="rounded-full p-1.5 hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </SheetClose>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-5">

          {/* Type toggle */}
          <div className="flex rounded-xl border p-1 gap-1">
            {(['expense', 'income', 'transfer'] as TransactionType[]).map(t => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                  type === t ? TYPE_STYLES[t].active : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="flex items-center justify-center gap-1 py-2">
            <span className={cn('text-4xl font-bold', TYPE_STYLES[type].amount)}>₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className={cn(
                'text-5xl font-bold bg-transparent border-none outline-none w-52 text-center',
                'placeholder:text-muted-foreground/40',
                '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                TYPE_STYLES[type].amount
              )}
            />
          </div>

          {/* Category */}
          {type !== 'transfer' && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Category</Label>
              <div className="grid grid-cols-4 gap-2">
                {visibleCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id!)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-all',
                      categoryId === cat.id
                        ? 'border-primary bg-primary/10'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    )}
                  >
                    <span className="text-2xl leading-none">{cat.icon}</span>
                    <span className="text-[10px] leading-tight text-muted-foreground line-clamp-1 w-full text-center">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* From Account */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              {type === 'transfer' ? 'From Account' : 'Account'}
            </Label>
            <Select value={accountId?.toString() ?? ''} onValueChange={v => setAccountId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts?.map(acc => (
                  <SelectItem key={acc.id} value={acc.id!.toString()}>{acc.icon} {acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Account */}
          {type === 'transfer' && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">To Account</Label>
              <Select value={toAccountId?.toString() ?? ''} onValueChange={v => setToAccountId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => a.id !== accountId).map(acc => (
                    <SelectItem key={acc.id} value={acc.id!.toString()}>{acc.icon} {acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Frequency */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Frequency</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {FREQ_OPTIONS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFrequency(f.value)}
                  className={cn(
                    'py-2.5 rounded-xl text-sm font-medium border transition-all',
                    frequency === f.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-transparent bg-muted/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start date */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              {isEditMode ? 'Next Date' : 'Start Date'}
            </Label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={cn(
                'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
                'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
              )}
            />
          </div>

          {/* End date (optional) */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">End Date (optional)</Label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              min={startDate}
              className={cn(
                'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
                'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
              )}
            />
          </div>

          {/* Note */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="What's this for?" maxLength={100} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t">
          {isEditMode ? (
            confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-center text-muted-foreground">Delete this rule? This can't be undone.</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={saving}>
                    {saving ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive px-3 h-12"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button onClick={handleSave} disabled={!isValid || saving} className="flex-1 h-12 text-base font-semibold">
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            )
          ) : (
            <Button onClick={handleSave} disabled={!isValid || saving} className="w-full h-12 text-base font-semibold">
              {saving ? 'Saving…' : 'Add Rule'}
            </Button>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
