import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus, Download, Moon, Sun, Trash2, RefreshCw, ChevronRight, Repeat,
} from 'lucide-react'
import { format } from 'date-fns'
import { db, type Category, type RecurringRule, seedDatabase } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/lib/theme'
import CategorySheet from './CategorySheet'
import RecurringSheet from './RecurringSheet'

// ── CSV export ─────────────────────────────────────────────────────────────────

async function exportCSV() {
  const [txs, categories, accounts] = await Promise.all([
    db.transactions.orderBy('date').toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
  ])

  const catMap = Object.fromEntries(categories.map(c => [c.id!, c]))
  const accMap = Object.fromEntries(accounts.map(a => [a.id!, a]))

  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

  const header = ['Date', 'Type', 'Category', 'Amount', 'Account', 'To Account', 'Note']
  const rows = txs.map(tx => [
    format(new Date(tx.date), 'yyyy-MM-dd'),
    tx.type,
    catMap[tx.categoryId]?.name ?? '',
    tx.amount,
    accMap[tx.accountId]?.name ?? '',
    tx.toAccountId ? (accMap[tx.toAccountId]?.name ?? '') : '',
    tx.note,
  ])

  const csv = [header, ...rows].map(row => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `expense-tracker-${format(new Date(), 'yyyy-MM-dd')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-2">
      {title}
    </p>
  )
}

function SettingRow({
  icon, label, right, onClick, destructive = false,
}: {
  icon: React.ReactNode
  label: string
  right?: React.ReactNode
  onClick?: () => void
  destructive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 w-full py-3.5 px-4 text-left transition-colors',
        onClick && 'hover:bg-accent/50 active:bg-accent',
        destructive && 'text-destructive'
      )}
    >
      <span className={destructive ? 'text-destructive' : 'text-muted-foreground'}>{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      {right ?? (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </button>
  )
}

// ── Recurring rule row ─────────────────────────────────────────────────────────

function RuleRow({
  rule,
  categoryMap,
  accountMap,
  onClick,
}: {
  rule: RecurringRule
  categoryMap: Record<number, Category>
  accountMap: Record<number, { name: string; icon: string }>
  onClick: () => void
}) {
  const t   = rule.transactionTemplate
  const cat = categoryMap[t.categoryId]
  const acc = accountMap[t.accountId]

  const freqLabel: Record<string, string> = {
    daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full py-3 px-4 text-left hover:bg-accent/50 active:bg-accent transition-colors"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: (cat?.color ?? '#6b7280') + '22' }}
      >
        {t.type === 'transfer' ? '↔️' : (cat?.icon ?? '📦')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {t.type === 'transfer' ? 'Transfer' : (cat?.name ?? 'Unknown')}
          {' · '}
          <span className="text-muted-foreground font-normal">{freqLabel[rule.frequency]}</span>
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Next: {format(new Date(rule.nextDate), 'd MMM yyyy')}
          {acc ? ` · ${acc.icon} ${acc.name}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <span className={cn(
          'text-sm font-semibold tabular-nums',
          t.type === 'income' ? 'text-green-500' : t.type === 'transfer' ? 'text-blue-400' : 'text-red-400'
        )}>
          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{formatCurrency(t.amount)}
        </span>
      </div>
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { dark, toggle: toggleDark } = useTheme()

  const categories    = useLiveQuery(() => db.categories.toArray(), [])
  const recurringRules = useLiveQuery(() => db.recurringRules.toArray(), [])
  const accounts      = useLiveQuery(() => db.accounts.toArray(), [])

  const [catSheetOpen,   setCatSheetOpen]   = useState(false)
  const [editingCat,     setEditingCat]     = useState<Category | undefined>(undefined)
  const [catDefaultType, setCatDefaultType] = useState<'expense' | 'income'>('expense')

  const [ruleSheetOpen, setRuleSheetOpen] = useState(false)
  const [editingRule,   setEditingRule]   = useState<RecurringRule | undefined>(undefined)

  // Reset state: 0 = idle, 1 = first confirm, 2 = second confirm
  const [resetStep,  setResetStep]  = useState<0 | 1 | 2>(0)
  const [resetting,  setResetting]  = useState(false)

  const expenseCategories = useMemo(() => (categories ?? []).filter(c => c.type === 'expense'), [categories])
  const incomeCategories  = useMemo(() => (categories ?? []).filter(c => c.type === 'income'),  [categories])

  const categoryMap = useMemo(
    () => Object.fromEntries((categories ?? []).map(c => [c.id!, c])),
    [categories]
  )
  const accountMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map(a => [a.id!, { name: a.name, icon: a.icon }])),
    [accounts]
  )

  function openAddCategory(type: 'expense' | 'income') {
    setEditingCat(undefined)
    setCatDefaultType(type)
    setCatSheetOpen(true)
  }

  function openEditCategory(cat: Category) {
    setEditingCat(cat)
    setCatSheetOpen(true)
  }

  function openAddRule() {
    setEditingRule(undefined)
    setRuleSheetOpen(true)
  }

  function openEditRule(rule: RecurringRule) {
    setEditingRule(rule)
    setRuleSheetOpen(true)
  }

  async function handleReset() {
    setResetting(true)
    try {
      await db.transaction('rw', [db.transactions, db.categories, db.accounts, db.budgets, db.recurringRules], async () => {
        await Promise.all([
          db.transactions.clear(),
          db.categories.clear(),
          db.accounts.clear(),
          db.budgets.clear(),
          db.recurringRules.clear(),
        ])
      })
      await seedDatabase()
      // Reset the recurring engine guard so it can run again after re-seed
      localStorage.removeItem('recurringLastProcessed')
      setResetStep(0)
    } catch (err) {
      console.error('Reset failed', err)
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <div className="flex flex-col pb-28">

        {/* ── Categories ───────────────────────────── */}
        <div className="px-4 pt-5 pb-1">
          <SectionHeader title="Categories" />
        </div>

        <div className="bg-card border-y divide-y divide-border/60">
          {/* Expense group */}
          <div className="px-4 py-2 bg-muted/30">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Expense</p>
          </div>
          {expenseCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => openEditCategory(cat)}
              className="flex items-center gap-3 w-full py-3 px-4 text-left hover:bg-accent/50 active:bg-accent transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                style={{ backgroundColor: cat.color + '22' }}
              >
                {cat.icon}
              </div>
              <span className="flex-1 text-sm">{cat.name}</span>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
            </button>
          ))}
          <button
            onClick={() => openAddCategory('expense')}
            className="flex items-center gap-3 w-full py-3 px-4 text-left text-primary hover:bg-accent/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Add Expense Category</span>
          </button>

          {/* Income group */}
          <div className="px-4 py-2 bg-muted/30">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Income</p>
          </div>
          {incomeCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => openEditCategory(cat)}
              className="flex items-center gap-3 w-full py-3 px-4 text-left hover:bg-accent/50 active:bg-accent transition-colors"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                style={{ backgroundColor: cat.color + '22' }}
              >
                {cat.icon}
              </div>
              <span className="flex-1 text-sm">{cat.name}</span>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
            </button>
          ))}
          <button
            onClick={() => openAddCategory('income')}
            className="flex items-center gap-3 w-full py-3 px-4 text-left text-primary hover:bg-accent/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Add Income Category</span>
          </button>
        </div>

        {/* ── Recurring Transactions ────────────────── */}
        <div className="px-4 pt-5 pb-1">
          <SectionHeader title="Recurring Transactions" />
        </div>

        <div className="bg-card border-y divide-y divide-border/60">
          {(recurringRules ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-5 px-4">
              No recurring rules set up yet.
            </p>
          )}
          {(recurringRules ?? []).map(rule => (
            <RuleRow
              key={rule.id}
              rule={rule}
              categoryMap={categoryMap}
              accountMap={accountMap}
              onClick={() => openEditRule(rule)}
            />
          ))}
          <button
            onClick={openAddRule}
            className="flex items-center gap-3 w-full py-3.5 px-4 text-left text-primary hover:bg-accent/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Add Recurring Transaction</span>
          </button>
        </div>

        {/* ── Preferences ───────────────────────────── */}
        <div className="px-4 pt-5 pb-1">
          <SectionHeader title="Preferences" />
        </div>

        <div className="bg-card border-y divide-y divide-border/60">
          {/* Dark mode */}
          <div className="flex items-center gap-3 w-full py-3.5 px-4">
            <span className="text-muted-foreground">
              {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </span>
            <span className="flex-1 text-sm">Dark Mode</span>
            <Switch checked={dark} onCheckedChange={toggleDark} />
          </div>

          {/* Export */}
          <SettingRow
            icon={<Download className="h-4 w-4" />}
            label="Export Transactions as CSV"
            onClick={exportCSV}
          />
        </div>

        {/* ── Danger Zone ───────────────────────────── */}
        <div className="px-4 pt-5 pb-1">
          <SectionHeader title="Danger Zone" />
        </div>

        <div className="bg-card border-y">
          {resetStep === 0 && (
            <SettingRow
              icon={<RefreshCw className="h-4 w-4" />}
              label="Reset All Data"
              destructive
              onClick={() => setResetStep(1)}
            />
          )}

          {resetStep === 1 && (
            <div className="px-4 py-4 flex flex-col gap-3">
              <p className="text-sm text-center text-muted-foreground">
                Are you sure? This will delete all transactions, budgets, accounts, and categories.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setResetStep(0)}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => setResetStep(2)}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {resetStep === 2 && (
            <div className="px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 justify-center text-destructive">
                <Trash2 className="h-4 w-4" />
                <p className="text-sm font-semibold">This cannot be undone.</p>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                All your data will be permanently deleted and the app will restart with default categories and accounts.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setResetStep(0)} disabled={resetting}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleReset} disabled={resetting}>
                  {resetting ? 'Resetting…' : 'Reset Everything'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── App info ──────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 mt-10 mb-2">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-muted-foreground">Expense Tracker</p>
          </div>
          <p className="text-xs text-muted-foreground/60">Version 1.0.0</p>
        </div>

      </div>

      {/* Sheets */}
      <CategorySheet
        open={catSheetOpen}
        onOpenChange={setCatSheetOpen}
        category={editingCat}
        defaultType={catDefaultType}
      />

      <RecurringSheet
        open={ruleSheetOpen}
        onOpenChange={setRuleSheetOpen}
        rule={editingRule}
      />
    </>
  )
}
