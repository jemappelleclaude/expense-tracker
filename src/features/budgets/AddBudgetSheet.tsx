import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { db, type Budget, type Category } from '@/lib/db'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: string           // "YYYY-MM"
  budget?: Budget         // undefined = add mode, defined = edit mode
  availableCategories: Category[]  // expense cats without a budget this month (add) or all expense cats (edit)
  editCategory?: Category          // the category for the budget being edited
}

export default function AddBudgetSheet({
  open, onOpenChange, month, budget, availableCategories, editCategory,
}: Props) {
  const isEditMode = !!budget

  const [categoryId,    setCategoryId]    = useState<number | null>(null)
  const [limit,         setLimit]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) { setConfirmDelete(false); return }
    if (budget) {
      setCategoryId(budget.categoryId)
      setLimit(budget.monthlyLimit.toString())
    } else {
      setCategoryId(null)
      setLimit('')
    }
  }, [open, budget?.id])

  const parsedLimit = parseFloat(limit)
  const isValid = !isNaN(parsedLimit) && parsedLimit > 0 && (isEditMode || categoryId !== null)

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    try {
      if (budget) {
        await db.budgets.put({ ...budget, monthlyLimit: parsedLimit })
      } else {
        await db.budgets.add({ categoryId: categoryId!, monthlyLimit: parsedLimit, month })
      }
      onOpenChange(false)
    } catch (err) {
      console.error('Save budget failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!budget) return
    setSaving(true)
    try {
      await db.budgets.delete(budget.id!)
      onOpenChange(false)
    } catch (err) {
      console.error('Delete budget failed', err)
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
            {isEditMode ? 'Edit Budget' : 'Add Budget'}
          </h2>
          <SheetClose className="rounded-full p-1.5 hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-5">

          {/* Amount */}
          <div className="flex items-center justify-center gap-1 py-3">
            <span className="text-4xl font-bold text-primary">₹</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={limit}
              onChange={e => setLimit(e.target.value)}
              placeholder="0"
              className={cn(
                'text-5xl font-bold bg-transparent border-none outline-none w-52 text-center text-primary',
                'placeholder:text-muted-foreground/40',
                '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
              )}
            />
          </div>

          {/* Category — picker in add mode, display only in edit mode */}
          {isEditMode ? (
            <div className="flex items-center gap-3 px-1">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: (editCategory?.color ?? '#6b7280') + '22' }}
              >
                {editCategory?.icon ?? '📦'}
              </div>
              <div>
                <p className="text-sm font-medium">{editCategory?.name ?? 'Category'}</p>
                <p className="text-xs text-muted-foreground">Category (can't be changed)</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Category</Label>
              {availableCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All expense categories already have a budget this month.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableCategories.map(cat => (
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
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t">
          {isEditMode ? (
            confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-center text-muted-foreground">
                  Delete this budget? This can't be undone.
                </p>
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
              {saving ? 'Saving…' : 'Add Budget'}
            </Button>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
