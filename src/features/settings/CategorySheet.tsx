import { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { db, type Category, type TransactionType } from '@/lib/db'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const PRESET_ICONS = [
  '🍔', '🍕', '🍜', '☕', '🛒', '🚗', '🚌', '✈️',
  '🏠', '💡', '🎬', '🎮', '🎵', '📚', '💊', '💪',
  '✂️', '👔', '📦', '💰', '💼', '📈', '🎁', '⚽',
  '🐶', '🌴', '🎓', '🏦', '💳', '🛍️', '📱', '💻',
]

const PRESET_COLORS = [
  '#f97316', '#ef4444', '#f59e0b', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#6b7280', '#10b981', '#6366f1', '#84cc16',
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category          // undefined = add mode
  defaultType?: TransactionType // for add mode
}

export default function CategorySheet({ open, onOpenChange, category, defaultType = 'expense' }: Props) {
  const isEditMode = !!category

  const [name,          setName]          = useState('')
  const [icon,          setIcon]          = useState('📦')
  const [color,         setColor]         = useState('#6b7280')
  const [type,          setType]          = useState<TransactionType>(defaultType)
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [txCount,       setTxCount]       = useState<number | null>(null)

  useEffect(() => {
    if (!open) { setConfirmDelete(false); setTxCount(null); return }
    if (category) {
      setName(category.name)
      setIcon(category.icon)
      setColor(category.color)
      setType(category.type as TransactionType)
    } else {
      setName('')
      setIcon('📦')
      setColor('#6b7280')
      setType(defaultType)
    }
  }, [open, category?.id, defaultType])

  useEffect(() => {
    if (!confirmDelete || !category?.id) return
    db.transactions.where('categoryId').equals(category.id).count().then(setTxCount)
  }, [confirmDelete, category?.id])

  const isValid = name.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    try {
      const now = new Date()
      if (category) {
        await db.categories.put({ ...category, name: name.trim(), icon, color })
      } else {
        await db.categories.add({ name: name.trim(), icon, color, type, isDefault: false, createdAt: now })
      }
      onOpenChange(false)
    } catch (err) {
      console.error('Save category failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!category || txCount === null || txCount > 0) return
    setSaving(true)
    try {
      await db.categories.delete(category.id!)
      onOpenChange(false)
    } catch (err) {
      console.error('Delete category failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh]">

        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold text-base">{isEditMode ? 'Edit Category' : 'Add Category'}</h2>
          <SheetClose className="rounded-full p-1.5 hover:bg-accent text-muted-foreground transition-colors">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </SheetClose>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-5">

          {/* Preview */}
          <div className="flex flex-col items-center gap-2 py-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: color + '22' }}
            >
              {icon}
            </div>
            <p className="text-sm font-medium text-muted-foreground">{name.trim() || 'Category name'}</p>
          </div>

          {/* Type — add mode only */}
          {!isEditMode && (
            <div className="flex rounded-xl border p-1 gap-1">
              {(['expense', 'income'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
                    type === t
                      ? t === 'expense' ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-500'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Category name" maxLength={30} />
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
                    icon === emoji ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted'
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
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t">
          {isEditMode ? (
            confirmDelete ? (
              <div className="flex flex-col gap-2">
                {txCount === null ? (
                  <p className="text-sm text-center text-muted-foreground">Checking…</p>
                ) : txCount > 0 ? (
                  <p className="text-sm text-center text-muted-foreground">
                    Cannot delete — {txCount} transaction{txCount !== 1 ? 's' : ''} use this category.
                  </p>
                ) : (
                  <p className="text-sm text-center text-muted-foreground">Delete this category? This can't be undone.</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)} disabled={saving}>
                    Cancel
                  </Button>
                  {txCount === 0 && (
                    <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={saving}>
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
              {saving ? 'Saving…' : 'Add Category'}
            </Button>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
