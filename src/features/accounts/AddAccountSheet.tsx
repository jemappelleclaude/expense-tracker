import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { db, type Account } from '@/lib/db'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const PRESET_ICONS = ['💵', '💳', '🏦', '💰', '👛', '💎', '🏠', '🚗', '✈️', '🎓', '💊', '🛍️', '📱', '💻', '🎯', '📂']
const PRESET_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316', '#f59e0b', '#ec4899', '#14b8a6']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account
  onDeleted?: () => void
}

export default function AddAccountSheet({ open, onOpenChange, account, onDeleted }: Props) {
  const isEditMode = !!account

  const [name,           setName]           = useState('')
  const [icon,           setIcon]           = useState('💵')
  const [color,          setColor]          = useState('#22c55e')
  const [openingBalance, setOpeningBalance] = useState('')
  const [saving,         setSaving]         = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [txCount,        setTxCount]        = useState<number | null>(null)

  useEffect(() => {
    if (!open) { setConfirmDelete(false); return }

    if (account) {
      setName(account.name)
      setIcon(account.icon)
      setColor(account.color)
      setOpeningBalance(account.openingBalance.toString())
    } else {
      setName('')
      setIcon('💵')
      setColor('#22c55e')
      setOpeningBalance('')
    }
  }, [open, account?.id])

  // Load tx count when entering delete confirmation
  useEffect(() => {
    if (!confirmDelete || !account?.id) return
    db.transactions
      .where('accountId').equals(account.id)
      .or('toAccountId').equals(account.id)
      .count()
      .then(setTxCount)
  }, [confirmDelete, account?.id])

  const isValid = name.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    try {
      const ob = parseFloat(openingBalance) || 0
      const now = new Date()
      if (account) {
        await db.accounts.put({
          ...account,
          name: name.trim(),
          icon,
          color,
          openingBalance: ob,
          balance: ob,
        })
      } else {
        await db.accounts.add({
          name:           name.trim(),
          type:           'other',
          icon,
          color,
          balance:        ob,
          openingBalance: ob,
          currency:       'INR',
          isDefault:      false,
          createdAt:      now,
        })
      }
      onOpenChange(false)
    } catch (err) {
      console.error('Save account failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!account || txCount === null || txCount > 0) return
    setSaving(true)
    try {
      await db.accounts.delete(account.id!)
      onDeleted?.()
      onOpenChange(false)
    } catch (err) {
      console.error('Delete account failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh]">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-base">
            {isEditMode ? 'Edit Account' : 'Add Account'}
          </h2>
          <SheetClose className="rounded-full p-1.5 hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-5">

          {/* Preview */}
          <div className="flex flex-col items-center gap-2 py-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ backgroundColor: color + '22' }}
            >
              {icon}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {name.trim() || 'Account name'}
            </p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Savings"
              maxLength={30}
            />
          </div>

          {/* Icon picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Icon</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_ICONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    'h-10 rounded-lg text-xl flex items-center justify-center transition-all',
                    icon === emoji
                      ? 'bg-primary/15 ring-2 ring-primary'
                      : 'bg-muted/50 hover:bg-muted active:bg-muted'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Opening balance */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              {isEditMode ? 'Opening Balance' : 'Opening Balance (optional)'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                placeholder="0"
                className="pl-7"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Starting balance before any transactions are recorded.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border/60">
          {isEditMode ? (
            confirmDelete ? (
              <div className="flex flex-col gap-2">
                {txCount === null ? (
                  <p className="text-sm text-center text-muted-foreground">Checking…</p>
                ) : txCount > 0 ? (
                  <p className="text-sm text-center text-muted-foreground">
                    Cannot delete — this account has {txCount} transaction{txCount !== 1 ? 's' : ''}.
                    Remove them first.
                  </p>
                ) : (
                  <p className="text-sm text-center text-muted-foreground">
                    Delete this account? This can't be undone.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  {txCount === 0 && (
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-xl"
                      onClick={handleDelete}
                      disabled={saving}
                    >
                      {saving ? 'Deleting…' : 'Delete'}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive px-3 h-12 rounded-xl"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isValid || saving}
                  className="flex-1 h-12 text-base font-semibold rounded-xl gradient-primary border-0 text-white shadow-lg shadow-violet-500/30"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            )
          ) : (
            <Button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="w-full h-12 text-base font-semibold rounded-xl gradient-primary border-0 text-white shadow-lg shadow-violet-500/30"
            >
              {saving ? 'Saving…' : 'Add Account'}
            </Button>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
