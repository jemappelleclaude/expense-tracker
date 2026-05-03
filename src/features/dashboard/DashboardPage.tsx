import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingDown, PiggyBank, Clock, ChevronRight, ArrowLeft, ReceiptText } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { NavLink } from 'react-router-dom'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { MonthSelector } from '@/components/MonthSelector'
import { useActions } from '@/lib/actions'

type DrilldownTarget = {
  type: 'category' | 'account'
  id: number
  name: string
  icon: string
  color: string
}

type CatEntry = { id: number; name: string; value: number; color: string; icon: string; count: number }
type AccEntry = { id: number; name: string; value: number; color: string; icon: string; count: number }

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null)

  const { openWorthIt } = useActions()

  useEffect(() => { setDrilldown(null) }, [year, month])

  const transactions = useLiveQuery(
    () => {
      const start = new Date(year, month, 1)
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return db.transactions.where('date').between(start, end, true, true).toArray()
    },
    [year, month]
  )

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const accounts   = useLiveQuery(() => db.accounts.toArray(), [])

  const skippedThisMonth = useLiveQuery(
    () => {
      const start = new Date(year, month, 1)
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return db.pendingPurchases
        .where('status').equals('skipped')
        .and(p => new Date(p.createdAt) >= start && new Date(p.createdAt) <= end)
        .toArray()
    },
    [year, month]
  )

  const pendingPurchases = useLiveQuery(
    () => db.pendingPurchases.where('status').equals('pending').toArray(),
    []
  )

  const categoryMap = useMemo(
    () => Object.fromEntries((categories ?? []).map(c => [c.id!, c])),
    [categories]
  )
  const accountMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map(a => [a.id!, a])),
    [accounts]
  )

  const { totalIncome, totalExpense, balance, categoryExpenses, categoryIncomes, accountBreakdown } = useMemo(() => {
    const txs = transactions ?? []
    let totalIncome = 0, totalExpense = 0
    const catExpAcc: Record<number, CatEntry> = {}
    const catIncAcc: Record<number, CatEntry> = {}
    const accAcc: Record<number, AccEntry> = {}

    txs.forEach(t => {
      const cat = categoryMap[t.categoryId]
      const acc = accountMap[t.accountId]

      if (t.type === 'income') {
        totalIncome += t.amount
        if (cat) {
          if (!catIncAcc[t.categoryId])
            catIncAcc[t.categoryId] = { id: t.categoryId, name: cat.name, value: 0, color: cat.color, icon: cat.icon, count: 0 }
          catIncAcc[t.categoryId].value += t.amount
          catIncAcc[t.categoryId].count++
        }
      } else if (t.type === 'expense') {
        totalExpense += t.amount
        if (cat) {
          if (!catExpAcc[t.categoryId])
            catExpAcc[t.categoryId] = { id: t.categoryId, name: cat.name, value: 0, color: cat.color, icon: cat.icon, count: 0 }
          catExpAcc[t.categoryId].value += t.amount
          catExpAcc[t.categoryId].count++
        }
        if (acc) {
          if (!accAcc[t.accountId])
            accAcc[t.accountId] = { id: t.accountId, name: acc.name, value: 0, color: acc.color, icon: acc.icon, count: 0 }
          accAcc[t.accountId].value += t.amount
          accAcc[t.accountId].count++
        }
      }
    })

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      categoryExpenses: Object.values(catExpAcc).sort((a, b) => b.value - a.value),
      categoryIncomes:  Object.values(catIncAcc).sort((a, b) => b.value - a.value),
      accountBreakdown: Object.values(accAcc).sort((a, b) => b.value - a.value),
    }
  }, [transactions, categoryMap, accountMap])

  const drilldownTxs = useMemo(() => {
    if (!drilldown) return []
    const sorted = (transactions ?? []).slice().sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    if (drilldown.type === 'category') {
      return sorted.filter(t => t.categoryId === drilldown.id)
    }
    return sorted.filter(t => t.accountId === drilldown.id || t.toAccountId === drilldown.id)
  }, [drilldown, transactions])

  const loaded  = transactions !== undefined
  const hasData = (transactions?.length ?? 0) > 0
  const maxBar  = Math.max(totalIncome, totalExpense, 1)

  return (
    <>
      {/* ── Sticky month selector ── */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      <div className="flex flex-col gap-4 pb-28">

        {/* ── Hero: Net Balance ── */}
        <div className="flex flex-col items-center gap-1 pt-6 pb-2 px-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Net Balance</p>
          <p className={cn(
            'text-4xl font-bold tabular-nums mt-1',
            balance < 0 ? 'text-red-400' : 'text-foreground'
          )}>
            {formatCurrency(balance)}
          </p>
          {(totalIncome > 0 || totalExpense > 0) && (
            <p className={cn(
              'text-xs mt-1 font-medium',
              balance > 0 ? 'text-emerald-500' : balance < 0 ? 'text-red-400' : 'text-muted-foreground'
            )}>
              {balance > 0
                ? `Saved ${formatCurrency(balance)} this month`
                : balance < 0
                ? `Overspent by ${formatCurrency(Math.abs(balance))}`
                : 'Income and expenses balanced'}
            </p>
          )}
        </div>

        {/* ── Income + Expense gradient cards ── */}
        <div className="grid grid-cols-2 gap-3 px-4">
          <div className="rounded-2xl p-4 border border-emerald-500/20 gradient-income">
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest">Income</p>
            <p className="text-xl font-bold text-emerald-500 tabular-nums mt-1.5 truncate">
              {formatCurrency(totalIncome)}
            </p>
            <NavLink
              to="/"
              className="text-[10px] text-emerald-500/60 hover:text-emerald-500 mt-2 block transition-colors"
            >
              See More →
            </NavLink>
          </div>
          <div className="rounded-2xl p-4 border border-red-500/20 gradient-expense">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">Expense</p>
            <p className="text-xl font-bold text-red-400 tabular-nums mt-1.5 truncate">
              {formatCurrency(totalExpense)}
            </p>
            <NavLink
              to="/"
              className="text-[10px] text-red-400/60 hover:text-red-400 mt-2 block transition-colors"
            >
              See More →
            </NavLink>
          </div>
        </div>

        {/* ── Spending donut ── */}
        <div className="mx-4 card-surface overflow-hidden">
          <div className="px-4 pt-4 pb-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Spending Breakdown
            </p>
          </div>
          <div className="px-4 pt-2 pb-4">
            {categoryExpenses.length > 0 ? (
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryExpenses}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={96}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {categoryExpenses.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const { name, value } = payload[0] as { name: string; value: number }
                        const pct = totalExpense > 0
                          ? ((value / totalExpense) * 100).toFixed(1)
                          : '0'
                        return (
                          <div className="rounded-xl border border-border/60 bg-card px-3 py-2 shadow-xl text-sm">
                            <p className="font-semibold">{name}</p>
                            <p className="text-muted-foreground">
                              {formatCurrency(value)} · {pct}%
                            </p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Spent</p>
                  <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">
                    {formatCurrency(totalExpense)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <TrendingDown className="h-10 w-10 opacity-20" />
                <p className="text-sm">No expenses this month</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Skipped savings card ── */}
        {(skippedThisMonth?.length ?? 0) > 0 && (() => {
          const saved = skippedThisMonth!.reduce((s, p) => s + p.price, 0)
          const count = skippedThisMonth!.length
          return (
            <div className="mx-4 flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3.5">
              <PiggyBank className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-500">
                  Saved {formatCurrency(saved)} this month
                </p>
                <p className="text-xs text-muted-foreground">
                  by skipping {count} impulse purchase{count !== 1 ? 's' : ''} — nice!
                </p>
              </div>
            </div>
          )
        })()}

        {/* ── Pending purchases ── */}
        {(pendingPurchases?.length ?? 0) > 0 && (
          <button
            onClick={openWorthIt}
            className="mx-4 flex items-center gap-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 px-4 py-3.5 w-[calc(100%-2rem)] text-left active:bg-violet-500/15 transition-colors"
          >
            <Clock className="h-5 w-5 text-violet-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-400">
                {pendingPurchases!.length} purchase{pendingPurchases!.length !== 1 ? 's' : ''} pending review
              </p>
              <p className="text-xs text-muted-foreground">Tap to revisit your Think About It list</p>
            </div>
            <ChevronRight className="h-4 w-4 text-violet-400/60 flex-shrink-0" />
          </button>
        )}

        {/* ── Expenses by Category ── */}
        {categoryExpenses.length > 0 && (
          <div className="mx-4 card-surface overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Expenses by Category
              </p>
            </div>
            <div className="flex flex-col">
              {categoryExpenses.map((cat, i) => (
                <button
                  key={cat.id}
                  onClick={() => setDrilldown({ type: 'category', id: cat.id, name: cat.name, icon: cat.icon, color: cat.color })}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 text-left w-full active:bg-accent/50 transition-colors',
                    i < categoryExpenses.length - 1 && 'border-b border-border/40'
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: cat.color + '28' }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.count} txn{cat.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-red-400 mr-1">
                    {formatCurrency(cat.value)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Income by Category ── */}
        {categoryIncomes.length > 0 && (
          <div className="mx-4 card-surface overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Income by Category
              </p>
            </div>
            <div className="flex flex-col">
              {categoryIncomes.map((cat, i) => (
                <button
                  key={cat.id}
                  onClick={() => setDrilldown({ type: 'category', id: cat.id, name: cat.name, icon: cat.icon, color: cat.color })}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3.5 text-left w-full active:bg-accent/50 transition-colors',
                    i < categoryIncomes.length - 1 && 'border-b border-border/40'
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: cat.color + '28' }}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.count} txn{cat.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-emerald-500 mr-1">
                    {formatCurrency(cat.value)}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Payment Methods ── */}
        {accountBreakdown.length > 0 && (
          <div className="mx-4 card-surface overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Payment Methods
              </p>
            </div>
            <div className="flex flex-col">
              {accountBreakdown.map((acc, i) => {
                const pct = totalExpense > 0 ? (acc.value / totalExpense) * 100 : 0
                return (
                  <button
                    key={acc.id}
                    onClick={() => setDrilldown({ type: 'account', id: acc.id, name: acc.name, icon: acc.icon, color: acc.color })}
                    className={cn(
                      'flex flex-col gap-2.5 px-4 py-3.5 text-left w-full active:bg-accent/50 transition-colors',
                      i < accountBreakdown.length - 1 && 'border-b border-border/40'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: acc.color + '28' }}
                      >
                        {acc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{acc.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{acc.count} txn{acc.count !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 mr-1">
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(acc.value)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-12 mr-8">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: acc.color }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Overview bars ── */}
        {(totalIncome > 0 || totalExpense > 0) && (
          <div className="mx-4 card-surface overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Overview
              </p>
            </div>
            <div className="px-4 pb-4 flex flex-col gap-4">
              {(
                [
                  { label: 'Income',  amount: totalIncome,  color: '#22c55e' },
                  { label: 'Expense', amount: totalExpense, color: '#ef4444' },
                ] as const
              ).map(({ label, amount, color }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(amount / maxBar) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loaded && !hasData && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            No data for this month
          </p>
        )}
      </div>

      {/* ── Drilldown overlay ── */}
      {drilldown && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/50 flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setDrilldown(null)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-muted/60 active:bg-muted transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: drilldown.color + '28' }}
            >
              {drilldown.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{drilldown.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {drilldownTxs.length} transaction{drilldownTxs.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            {drilldownTxs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <ReceiptText className="h-10 w-10 opacity-20" />
                <p className="text-sm">No transactions</p>
              </div>
            ) : (
              <div className="mx-4 mt-4 card-surface overflow-hidden">
                {drilldownTxs.map((tx, i) => {
                  const cat = categoryMap[tx.categoryId]
                  const acc = accountMap[tx.accountId]
                  const d   = new Date(tx.date)
                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3.5',
                        i < drilldownTxs.length - 1 && 'border-b border-border/40'
                      )}
                    >
                      <div className="flex flex-col items-center justify-center w-8 flex-shrink-0 text-center">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase leading-none">
                          {format(d, 'MMM')}
                        </span>
                        <span className="text-base font-bold leading-tight tabular-nums">
                          {format(d, 'd')}
                        </span>
                      </div>

                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: (cat?.color ?? '#7C3AED') + '28' }}
                      >
                        {tx.type === 'transfer' ? '↔️' : (cat?.icon ?? '💸')}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tx.note || cat?.name || 'Transaction'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {acc?.name ?? ''}
                        </p>
                      </div>

                      <span className={cn(
                        'text-sm font-bold tabular-nums flex-shrink-0',
                        tx.type === 'income'    ? 'text-emerald-500'
                        : tx.type === 'expense' ? 'text-red-400'
                        : 'text-violet-400'
                      )}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
