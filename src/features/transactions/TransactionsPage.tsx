import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ReceiptText } from 'lucide-react'
import { isToday, isYesterday, format } from 'date-fns'
import { MonthSelector } from '@/components/MonthSelector'
import { db, type Transaction } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import AddTransactionSheet from './AddTransactionSheet'

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'd MMM, EEE')
}

export default function TransactionsPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [editingTx, setEditingTx] = useState<Transaction | undefined>(undefined)

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

  const categoryMap = useMemo(
    () => Object.fromEntries((categories ?? []).map(c => [c.id!, c])),
    [categories]
  )
  const accountMap = useMemo(
    () => Object.fromEntries((accounts ?? []).map(a => [a.id!, a])),
    [accounts]
  )

  const { totalIncome, totalExpense, balance, groups } = useMemo(() => {
    const txs = transactions ?? []
    let totalIncome = 0, totalExpense = 0

    const sorted = [...txs].sort((a, b) => {
      const d = new Date(b.date).getTime() - new Date(a.date).getTime()
      return d !== 0 ? d : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    type Group = { dateKey: string; date: Date; label: string; net: number; transactions: Transaction[] }
    const map = new Map<string, Group>()

    sorted.forEach(tx => {
      if (tx.type === 'income')  totalIncome  += tx.amount
      if (tx.type === 'expense') totalExpense += tx.amount

      const d   = new Date(tx.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) {
        map.set(key, { dateKey: key, date: d, label: getDateLabel(d), net: 0, transactions: [] })
      }
      const g = map.get(key)!
      g.transactions.push(tx)
      if (tx.type === 'income')  g.net += tx.amount
      if (tx.type === 'expense') g.net -= tx.amount
    })

    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, groups: Array.from(map.values()) }
  }, [transactions])

  const loaded = transactions !== undefined

  return (
    <>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/50">
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />

        {/* Summary bar */}
        <div className="grid grid-cols-3 divide-x divide-border/60 pb-3 px-1">
          <div className="text-center px-1">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Income</p>
            <p className="text-sm font-bold text-emerald-500 mt-0.5 tabular-nums truncate px-1">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="text-center px-1">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Expense</p>
            <p className="text-sm font-bold text-red-400 mt-0.5 tabular-nums truncate px-1">
              {formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="text-center px-1">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Balance</p>
            <p className={cn(
              'text-sm font-bold mt-0.5 tabular-nums truncate px-1',
              balance > 0 ? 'text-emerald-500' : balance < 0 ? 'text-red-400' : 'text-foreground'
            )}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="pb-28">

        {loaded && groups.length === 0 && (
          <div className="flex flex-col items-center gap-3 mt-20 text-muted-foreground select-none">
            <ReceiptText className="h-12 w-12 opacity-20" />
            <p className="text-sm">No transactions yet</p>
          </div>
        )}

        {groups.map(group => (
          <div key={group.dateKey} className="mb-1">

            {/* Date group header */}
            <div className="flex items-center justify-between px-4 py-2 mt-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </span>
              <span className={cn(
                'text-xs font-semibold tabular-nums',
                group.net > 0 ? 'text-emerald-500' : group.net < 0 ? 'text-red-400' : 'text-muted-foreground'
              )}>
                {group.net > 0 ? '+' : ''}{formatCurrency(group.net)}
              </span>
            </div>

            {/* Transaction rows inside a card */}
            <div className="mx-4 rounded-2xl bg-card border border-border/60 overflow-hidden">
              {group.transactions.map((tx, i) => {
                const cat   = categoryMap[tx.categoryId]
                const acc   = accountMap[tx.accountId]
                const toAcc = tx.toAccountId ? accountMap[tx.toAccountId] : undefined

                return (
                  <button
                    key={tx.id}
                    onClick={() => setEditingTx(tx)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3.5 w-full text-left',
                      'active:bg-accent/50 transition-colors',
                      i < group.transactions.length - 1 && 'border-b border-border/40'
                    )}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: (cat?.color ?? '#7C3AED') + '28' }}
                    >
                      {tx.type === 'transfer' ? '↔️' : (cat?.icon ?? '💸')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {cat?.name ?? (tx.type === 'transfer' ? 'Transfer' : 'Transaction')}
                      </p>
                      {tx.note ? (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.note}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 truncate mt-0.5">
                          {toAcc ? `${acc?.name ?? ''} → ${toAcc.name}` : (acc?.name ?? '')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className={cn(
                        'text-sm font-bold tabular-nums',
                        tx.type === 'income'   ? 'text-emerald-500'
                        : tx.type === 'transfer' ? 'text-violet-400'
                        : 'text-red-400'
                      )}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatCurrency(tx.amount)}
                      </span>
                      {tx.note && (
                        <span className="text-[10px] text-muted-foreground/50">
                          {toAcc ? `${acc?.name ?? ''} → ${toAcc.name}` : (acc?.name ?? '')}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <AddTransactionSheet
        open={editingTx !== undefined}
        onOpenChange={open => { if (!open) setEditingTx(undefined) }}
        transaction={editingTx}
      />
    </>
  )
}
