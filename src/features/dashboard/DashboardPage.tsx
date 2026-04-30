import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingDown, PiggyBank, Clock, ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { NavLink } from 'react-router-dom'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { MonthSelector } from '@/components/MonthSelector'
import { useActions } from '@/lib/actions'

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const { openWorthIt } = useActions()

  const transactions = useLiveQuery(
    () => {
      const start = new Date(year, month, 1)
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return db.transactions.where('date').between(start, end, true, true).toArray()
    },
    [year, month]
  )

  const categories = useLiveQuery(() => db.categories.toArray(), [])

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

  const { totalIncome, totalExpense, balance, categoryExpenses } = useMemo(() => {
    const txs = transactions ?? []
    let totalIncome = 0, totalExpense = 0
    const catAcc: Record<number, { name: string; value: number; color: string; icon: string }> = {}

    txs.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount
      } else if (t.type === 'expense') {
        totalExpense += t.amount
        const cat = categoryMap[t.categoryId]
        if (cat) {
          if (!catAcc[t.categoryId])
            catAcc[t.categoryId] = { name: cat.name, value: 0, color: cat.color, icon: cat.icon }
          catAcc[t.categoryId].value += t.amount
        }
      }
    })

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      categoryExpenses: Object.values(catAcc).sort((a, b) => b.value - a.value),
    }
  }, [transactions, categoryMap])

  const loaded  = transactions !== undefined
  const hasData = (transactions?.length ?? 0) > 0
  const topMax  = categoryExpenses[0]?.value ?? 1
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
            balance > 0 ? 'text-foreground' : balance < 0 ? 'text-red-400' : 'text-foreground'
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
              <>
                {/* Donut with centre label */}
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

                  {/* Centre text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Spent</p>
                    <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">
                      {formatCurrency(totalExpense)}
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2.5 mt-1">
                  {categoryExpenses.slice(0, 5).map(cat => {
                    const pct = Math.round((cat.value / totalExpense) * 100)
                    return (
                      <div key={cat.name} className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: cat.color }}
                        />
                        <span className="flex-1 text-sm text-muted-foreground truncate">
                          {cat.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                          {pct}%
                        </span>
                        <span className="text-sm font-semibold tabular-nums w-20 text-right">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
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

        {/* ── Top 5 spending ── */}
        {categoryExpenses.length > 0 && (
          <div className="mx-4 card-surface overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                Top Spending
              </p>
            </div>
            <div className="px-4 pb-4 flex flex-col gap-4">
              {categoryExpenses.slice(0, 5).map(cat => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: cat.color + '25' }}
                  >
                    {cat.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm font-medium truncate">{cat.name}</span>
                      <span className="text-sm font-semibold tabular-nums ml-2 flex-shrink-0">
                        {formatCurrency(cat.value)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(cat.value / topMax) * 100}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
    </>
  )
}
