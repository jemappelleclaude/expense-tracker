import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, PiggyBank } from 'lucide-react'
import { db, type Budget, type Category } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { MonthSelector } from '@/components/MonthSelector'
import AddBudgetSheet from './AddBudgetSheet'

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function barColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 90)  return 'bg-red-400'
  if (pct >= 75)  return 'bg-yellow-400'
  return 'bg-green-500'
}

export default function BudgetsPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [addOpen,      setAddOpen]      = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined)

  const key = monthKey(year, month)

  const budgets    = useLiveQuery(() => db.budgets.where('month').equals(key).toArray(), [key])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const transactions = useLiveQuery(
    () => {
      const start = new Date(year, month, 1)
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return db.transactions.where('date').between(start, end, true, true).toArray()
    },
    [year, month]
  )

  const categoryMap = useMemo(
    () => Object.fromEntries((categories ?? []).map(c => [c.id!, c])),
    [categories]
  )

  // Expense categories that don't yet have a budget this month — for the add sheet
  const budgetedCategoryIds = useMemo(
    () => new Set((budgets ?? []).map(b => b.categoryId)),
    [budgets]
  )

  const expenseCategories = useMemo(
    () => (categories ?? []).filter(c => c.type === 'expense'),
    [categories]
  )

  const availableForAdd = useMemo(
    () => expenseCategories.filter(c => !budgetedCategoryIds.has(c.id!)),
    [expenseCategories, budgetedCategoryIds]
  )

  // Spent per category for this month
  const spentByCategory = useMemo(() => {
    return (transactions ?? [])
      .filter(t => t.type === 'expense')
      .reduce<Record<number, number>>((acc, t) => {
        acc[t.categoryId] = (acc[t.categoryId] ?? 0) + t.amount
        return acc
      }, {})
  }, [transactions])

  // Enriched budget rows
  const rows = useMemo(() => {
    return (budgets ?? []).map(b => {
      const cat   = categoryMap[b.categoryId]
      const spent = spentByCategory[b.categoryId] ?? 0
      const pct   = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0
      const over  = spent > b.monthlyLimit
      return { budget: b, cat, spent, pct, over }
    }).sort((a, b) => b.pct - a.pct) // most-stressed budgets first
  }, [budgets, categoryMap, spentByCategory])

  // Overall summary
  const { totalBudgeted, totalSpent } = useMemo(() => ({
    totalBudgeted: rows.reduce((s, r) => s + r.budget.monthlyLimit, 0),
    totalSpent:    rows.reduce((s, r) => s + r.spent, 0),
  }), [rows])

  const overallPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

  const editCategory: Category | undefined = editingBudget
    ? categoryMap[editingBudget.categoryId]
    : undefined

  const loaded = budgets !== undefined

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      <div className="flex flex-col gap-4 p-4 pb-28">

        {/* Overall summary */}
        {rows.length > 0 && (
          <div className="rounded-2xl bg-card border p-4 flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Overall</p>
              <p className={cn(
                'text-xs font-semibold tabular-nums',
                overallPct >= 100 ? 'text-red-400'
                : overallPct >= 75 ? 'text-yellow-400'
                : 'text-green-500'
              )}>
                {overallPct.toFixed(0)}%
              </p>
            </div>

            {/* Overall bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor(overallPct))}
                style={{ width: `${Math.min(overallPct, 100)}%` }}
              />
            </div>

            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="text-center pr-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Budgeted</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{formatCurrency(totalBudgeted)}</p>
              </div>
              <div className="text-center px-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Spent</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{formatCurrency(totalSpent)}</p>
              </div>
              <div className="text-center pl-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {totalSpent > totalBudgeted ? 'Over' : 'Left'}
                </p>
                <p className={cn(
                  'text-sm font-semibold tabular-nums mt-0.5',
                  totalSpent > totalBudgeted ? 'text-red-400' : 'text-green-500'
                )}>
                  {formatCurrency(Math.abs(totalBudgeted - totalSpent))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Budget cards */}
        {rows.map(({ budget: b, cat, spent, pct, over }) => (
          <button
            key={b.id}
            onClick={() => setEditingBudget(b)}
            className="w-full rounded-2xl bg-card border p-4 flex flex-col gap-3 text-left active:bg-accent/50 transition-colors"
          >
            {/* Category row */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: (cat?.color ?? '#6b7280') + '22' }}
              >
                {cat?.icon ?? '📦'}
              </div>
              <p className="flex-1 text-sm font-semibold">{cat?.name ?? 'Unknown'}</p>
              <p className={cn(
                'text-xs font-semibold tabular-nums',
                pct >= 100 ? 'text-red-400'
                : pct >= 75 ? 'text-yellow-400'
                : 'text-green-500'
              )}>
                {pct.toFixed(0)}%
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor(pct))}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>

            {/* Amounts row */}
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground tabular-nums">
                <span className={cn('font-medium', over ? 'text-red-400' : 'text-foreground')}>
                  {formatCurrency(spent)}
                </span>
                {' '}spent of{' '}
                <span>{formatCurrency(b.monthlyLimit)}</span>
              </p>
              {over ? (
                <p className="text-xs font-semibold text-red-400 tabular-nums">
                  {formatCurrency(spent - b.monthlyLimit)} over
                </p>
              ) : (
                <p className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground">{formatCurrency(b.monthlyLimit - spent)}</span>
                  {' '}left
                </p>
              )}
            </div>
          </button>
        ))}

        {/* Empty state */}
        {loaded && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-16 text-muted-foreground select-none">
            <PiggyBank className="h-12 w-12 opacity-20" />
            <p className="text-sm">No budgets set for this month</p>
            <p className="text-xs opacity-70">Tap + to add your first budget</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add budget"
        className="fixed bottom-[4.75rem] right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* Add budget sheet */}
      <AddBudgetSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        month={key}
        availableCategories={availableForAdd}
      />

      {/* Edit budget sheet */}
      <AddBudgetSheet
        open={!!editingBudget}
        onOpenChange={open => { if (!open) setEditingBudget(undefined) }}
        month={key}
        budget={editingBudget}
        availableCategories={expenseCategories}
        editCategory={editCategory}
      />
    </>
  )
}
