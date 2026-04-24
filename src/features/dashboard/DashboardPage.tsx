import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { TrendingDown } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { db } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MonthSelector } from '@/components/MonthSelector'

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const transactions = useLiveQuery(
    () => {
      const start = new Date(year, month, 1)
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return db.transactions.where('date').between(start, end, true, true).toArray()
    },
    [year, month]
  )

  const categories = useLiveQuery(() => db.categories.toArray(), [])

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

  const loaded    = transactions !== undefined
  const hasData   = (transactions?.length ?? 0) > 0
  const maxBar    = Math.max(totalIncome, totalExpense, 1)
  const topMax    = categoryExpenses[0]?.value ?? 1

  return (
    <>
      {/* ── Sticky header ─────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      <div className="flex flex-col gap-4 p-4 pb-28">

        {/* ── Summary cards ─────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Income</p>
            <p className="mt-1 text-sm font-bold text-green-500 tabular-nums truncate w-full text-center">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Expense</p>
            <p className="mt-1 text-sm font-bold text-red-400 tabular-nums truncate w-full text-center">
              {formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="flex flex-col items-center p-3 rounded-xl bg-card border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance</p>
            <p className={cn(
              'mt-1 text-sm font-bold tabular-nums truncate w-full text-center',
              balance > 0 ? 'text-green-500' : balance < 0 ? 'text-red-400' : 'text-foreground'
            )}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {/* ── Spending pie ──────────────────────── */}
        <Card>
          <CardHeader className="pb-0 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Spending
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {categoryExpenses.length > 0 ? (
              <>
                {/* Donut with centre label */}
                <div className="relative">
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={categoryExpenses}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={88}
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
                            <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-sm">
                              <p className="font-medium">{name}</p>
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
                    <p className="text-[11px] text-muted-foreground">Total</p>
                    <p className="text-lg font-bold tabular-nums leading-tight">
                      {formatCurrency(totalExpense)}
                    </p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2 mt-1">
                  {categoryExpenses.slice(0, 5).map(cat => {
                    const pct = Math.round((cat.value / totalExpense) * 100)
                    return (
                      <div key={cat.name} className="flex items-center gap-2">
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
                        <span className="text-sm font-medium tabular-nums w-20 text-right">
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
          </CardContent>
        </Card>

        {/* ── Top 5 spending ────────────────────── */}
        {categoryExpenses.length > 0 && (
          <Card>
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Top Spending
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 flex flex-col gap-4">
              {categoryExpenses.slice(0, 5).map(cat => (
                <div key={cat.name} className="flex items-center gap-3">
                  {/* Icon */}
                  <span className="text-xl w-7 text-center flex-shrink-0">{cat.icon}</span>

                  {/* Name + bar + amount */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm font-medium truncate">{cat.name}</span>
                      <span className="text-sm tabular-nums text-muted-foreground ml-2 flex-shrink-0">
                        {formatCurrency(cat.value)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
            </CardContent>
          </Card>
        )}

        {/* ── Income vs Expense overview ─────────── */}
        {(totalIncome > 0 || totalExpense > 0) && (
          <Card>
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 flex flex-col gap-4">
              {(
                [
                  { label: 'Income',  amount: totalIncome,  barClass: 'bg-green-500' },
                  { label: 'Expense', amount: totalExpense, barClass: 'bg-red-400' },
                ] as const
              ).map(({ label, amount, barClass }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(barClass, 'h-full rounded-full transition-all duration-500')}
                      style={{ width: `${(amount / maxBar) * 100}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Net label */}
              <p className={cn(
                'text-xs text-center',
                balance > 0 ? 'text-green-500'
                  : balance < 0 ? 'text-red-400'
                  : 'text-muted-foreground'
              )}>
                {balance > 0
                  ? `Saved ${formatCurrency(balance)} this month`
                  : balance < 0
                  ? `Overspent by ${formatCurrency(Math.abs(balance))}`
                  : 'Income and expenses balanced'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Global empty state ────────────────── */}
        {loaded && !hasData && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            No data for this month
          </p>
        )}
      </div>
    </>
  )
}
