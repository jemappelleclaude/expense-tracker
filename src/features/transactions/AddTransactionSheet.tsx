import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Trash2 } from 'lucide-react'
import { db, type Transaction, type TransactionType } from '@/lib/db'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toInputDate(d: Date | string): string {
  const date = new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Prefill {
  amount?: number
  categoryId?: number
  note?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction  // undefined = add mode, defined = edit mode
  prefill?: Prefill
}

const TYPE_STYLES: Record<TransactionType, { active: string; amount: string }> = {
  expense:  { active: 'bg-red-500/15 text-red-400',    amount: 'text-red-400'   },
  income:   { active: 'bg-green-500/15 text-green-500', amount: 'text-green-500' },
  transfer: { active: 'bg-blue-500/15 text-blue-400',   amount: 'text-blue-400'  },
}

export default function AddTransactionSheet({ open, onOpenChange, transaction, prefill }: Props) {
  const isEditMode = !!transaction

  const [type,        setType]        = useState<TransactionType>('expense')
  const [amount,      setAmount]      = useState('')
  const [categoryId,  setCategoryId]  = useState<number | null>(null)
  const [accountId,   setAccountId]   = useState<number | null>(null)
  const [toAccountId, setToAccountId] = useState<number | null>(null)
  const [date,        setDate]        = useState(todayString)
  const [note,        setNote]        = useState('')
  const [saving,      setSaving]      = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const accounts   = useLiveQuery(() => db.accounts.toArray(), [])

  const visibleCategories = categories?.filter(c =>
    c.type === (type === 'transfer' ? 'expense' : type)
  ) ?? []

  // ── Init / reset when sheet opens or switches between transactions ──────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) { setConfirmDelete(false); return }

    if (transaction) {
      setType(transaction.type)
      setAmount(transaction.amount.toString())
      setCategoryId(transaction.type !== 'transfer' ? transaction.categoryId : null)
      setAccountId(transaction.accountId)
      setToAccountId(transaction.toAccountId ?? null)
      setDate(toInputDate(transaction.date))
      setNote(transaction.note)
    } else {
      setType('expense')
      setAmount(prefill?.amount?.toString() ?? '')
      setCategoryId(prefill?.categoryId ?? null)
      setToAccountId(null)
      setDate(todayString())
      setNote(prefill?.note ?? '')
      // accountId not reset — keeps last-used account for convenience
    }
  // prefill is intentionally excluded — only apply on open, not on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id])

  // Default account for add mode when accountId is unset
  useEffect(() => {
    if (open && accountId === null && accounts?.length) {
      setAccountId((accounts.find(a => a.isDefault) ?? accounts[0]).id!)
    }
  }, [open, accountId, accounts])

  // Clear toAccountId if it collides after accountId changes
  useEffect(() => {
    if (toAccountId !== null && toAccountId === accountId) setToAccountId(null)
  }, [accountId, toAccountId])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function handleTypeChange(t: TransactionType) {
    if (t === type) return
    setType(t)
    setCategoryId(null) // inline clear avoids race with init useEffect
  }

  function resetForm() {
    setAmount('')
    setCategoryId(null)
    setToAccountId(null)
    setDate(todayString())
    setNote('')
    setSaving(false)
    setConfirmDelete(false)
  }

  const parsedAmount = parseFloat(amount)
  const isValid =
    !isNaN(parsedAmount) && parsedAmount > 0 &&
    accountId !== null &&
    (type === 'transfer'
      ? toAccountId !== null && toAccountId !== accountId
      : categoryId !== null)

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    try {
      const now    = new Date()
      const txDate = new Date(date + 'T00:00:00')

      if (transaction) {
        await db.transactions.put({
          ...transaction,
          type,
          amount:      parsedAmount,
          categoryId:  type === 'transfer' ? 0 : categoryId!,
          accountId:   accountId!,
          toAccountId: type === 'transfer' ? toAccountId! : undefined,
          date:        txDate,
          note:        note.trim(),
          isRecurring: false,
          updatedAt:   now,
        })
      } else {
        await db.transactions.add({
          type,
          amount:      parsedAmount,
          categoryId:  type === 'transfer' ? 0 : categoryId!,
          accountId:   accountId!,
          toAccountId: type === 'transfer' ? toAccountId! : undefined,
          date:        txDate,
          note:        note.trim(),
          isRecurring: false,
          createdAt:   now,
          updatedAt:   now,
        })
      }

      resetForm()
      onOpenChange(false)
    } catch (err) {
      console.error('Save failed', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!transaction) return
    setSaving(true)
    try {
      await db.transactions.delete(transaction.id!)
      resetForm()
      onOpenChange(false)
    } catch (err) {
      console.error('Delete failed', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh]">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-base">
            {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <SheetClose className="rounded-full p-1.5 hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>

        {/* Scrollable body */}
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
          <div className="flex items-center justify-center gap-1 py-3">
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

          {/* Category grid */}
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
                        : 'border-transparent bg-muted/50 hover:bg-muted active:bg-muted'
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

          {/* Account */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              {type === 'transfer' ? 'From Account' : 'Account'}
            </Label>
            <Select
              value={accountId?.toString() ?? ''}
              onValueChange={v => setAccountId(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map(acc => (
                  <SelectItem key={acc.id} value={acc.id!.toString()}>
                    {acc.icon} {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Account — transfer only */}
          {type === 'transfer' && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">To Account</Label>
              <Select
                value={toAccountId?.toString() ?? ''}
                onValueChange={v => setToAccountId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => a.id !== accountId).map(acc => (
                    <SelectItem key={acc.id} value={acc.id!.toString()}>
                      {acc.icon} {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date</Label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={cn(
                'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'text-foreground'
              )}
            />
          </div>

          {/* Note */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Note (optional)</Label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What's this for?"
              maxLength={100}
            />
          </div>
        </div>

        {/* Footer — pinned */}
        <div className="flex-shrink-0 px-4 py-3 border-t">
          {isEditMode ? (
            confirmDelete ? (
              /* Delete confirmation */
              <div className="flex flex-col gap-2">
                <p className="text-sm text-center text-muted-foreground">
                  Delete this transaction? This can't be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    {saving ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Edit mode footer */
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive px-3 h-12"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isValid || saving}
                  className="flex-1 h-12 text-base font-semibold"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            )
          ) : (
            /* Add mode footer */
            <Button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="w-full h-12 text-base font-semibold"
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
