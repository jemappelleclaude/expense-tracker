import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { isToday, isYesterday, format } from 'date-fns'
import { db, type Account, type Transaction } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { MonthSelector } from '@/components/MonthSelector'
import AddTransactionSheet from '@/features/transactions/AddTransactionSheet'

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'd MMM, EEE')
}

export function computeBalance(account: Account, txs: Transaction[]): number {
  return txs.reduce((bal, tx) => {
    if (tx.accountId === account.id) {
      if (tx.type === 'income')   return bal + tx.amount
      if (tx.type === 'expense')  return bal - tx.amount
      if (tx.type === 'transfer') return bal - tx.amount
    }
    if (tx.toAccountId === account.id && tx.type === 'transfer') return bal + tx.amount
    return bal
  }, account.openingBalance ?? 0)
}

interface Props {
  account: Account
  onBack: () => void
}

export default function AccountTransactionsView({ account, onBack }: Props) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [editingTx, setEditingTx] = useState<Transaction | null | undefined>(undefined)

  // All transactions ever for this account (for balance computation)
  const allTxs = useLiveQuery(
    () => db.transactions
      .where('accountId').equals(account.id!)
      .or('toAccountId').equals(account.id!)
      .toArray(),
    [account.id]
  )

  // Transactions in the selected month for display
  const monthTxs = useLiveQuery(
    () => {
      const start = new Date(year, month, 1)
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)
      return db.transactions
        .where('date').between(start, end, true, true)
        .toArray()
        .then(txs => txs.filter(tx => tx.accountId === account.id || tx.toAccountId === account.id))
    },
    [year, month, account.id]
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

  const balance = useMemo(
    () => allTxs ? computeBalance(account, allTxs) : account.openingBalance ?? 0,
    [account, allTxs]
  )

  const { totalIn, totalOut, groups } = useMemo(() => {
    const txs = monthTxs ?? []
    let totalIn = 0, totalOut = 0

    const sorted = [...txs].sort((a, b) => {
      const d = new Date(b.date).getTime() - new Date(a.date).getTime()
      return d !== 0 ? d : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    type Group = { dateKey: string; date: Date; label: string; net: number; transactions: Transaction[] }
    const map = new Map<string, Group>()

    sorted.forEach(tx => {
      const isFrom = tx.accountId === account.id
      const isTo   = tx.toAccountId === account.id

      if (tx.type === 'income'  && isFrom) totalIn  += tx.amount
      if (tx.type === 'expense' && isFrom) totalOut += tx.amount
      if (tx.type === 'transfer') {
        if (isTo)   totalIn  += tx.amount
        if (isFrom) totalOut += tx.amount
      }

      const d   = new Date(tx.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) {
        map.set(key, { dateKey: key, date: d, label: getDateLabel(d), net: 0, transactions: [] })
      }
      const g = map.get(key)!
      g.transactions.push(tx)

      if (tx.type === 'income'  && isFrom) g.net += tx.amount
      if (tx.type === 'expense' && isFrom) g.net -= tx.amount
      if (tx.type === 'transfer') {
        if (isTo)   g.net += tx.amount
        if (isFrom) g.net -= tx.amount
      }
    })

    return { totalIn, totalOut, groups: Array.from(map.values()) }
  }, [monthTxs, account.id])

  const loaded = monthTxs !== undefined

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-accent active:bg-accent/70 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
            style={{ backgroundColor: account.color + '22' }}
          >
            {account.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-tight truncate">{account.name}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={cn(
              'text-base font-bold tabular-nums',
              balance > 0 ? 'text-green-500' : balance < 0 ? 'text-red-400' : 'text-foreground'
            )}>
              {formatCurrency(balance)}
            </p>
            <p className="text-[10px] text-muted-foreground">balance</p>
          </div>
        </div>

        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />

        {/* Monthly summary */}
        <div className="grid grid-cols-3 divide-x divide-border pb-2.5">
          <div className="text-center px-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">In</p>
            <p className="text-sm font-semibold text-green-500 mt-0.5 tabular-nums truncate px-1">
              {formatCurrency(totalIn)}
            </p>
          </div>
          <div className="text-center px-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Out</p>
            <p className="text-sm font-semibold text-red-400 mt-0.5 tabular-nums truncate px-1">
              {formatCurrency(totalOut)}
            </p>
          </div>
          <div className="text-center px-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Net</p>
            <p className={cn(
              'text-sm font-semibold mt-0.5 tabular-nums truncate px-1',
              (totalIn - totalOut) > 0 ? 'text-green-500'
              : (totalIn - totalOut) < 0 ? 'text-red-400'
              : 'text-foreground'
            )}>
              {formatCurrency(totalIn - totalOut)}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-28">
        {loaded && groups.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-20 select-none">
            No transactions this month
          </p>
        )}

        {groups.map(group => (
          <div key={group.dateKey}>
            <div className="flex items-center justify-between px-4 py-1.5 bg-muted/40">
              <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
              <span className={cn(
                'text-xs font-medium tabular-nums',
                group.net > 0 ? 'text-green-500' : group.net < 0 ? 'text-red-400' : 'text-muted-foreground'
              )}>
                {group.net > 0 ? '+' : ''}{formatCurrency(group.net)}
              </span>
            </div>

            {group.transactions.map((tx, i) => {
              const cat   = categoryMap[tx.categoryId]
              const from  = accountMap[tx.accountId]
              const toAcc = tx.toAccountId ? accountMap[tx.toAccountId] : undefined
              const isTo  = tx.toAccountId === account.id

              // Determine sign color from this account's perspective
              let amountColor = 'text-foreground'
              if (tx.type === 'income') amountColor = 'text-green-500'
              else if (tx.type === 'expense') amountColor = 'text-red-400'
              else if (tx.type === 'transfer') amountColor = isTo ? 'text-green-500' : 'text-red-400'

              const sign = tx.type === 'income'
                ? '+'
                : tx.type === 'expense'
                ? '-'
                : (isTo ? '←' : '→')

              return (
                <button
                  key={tx.id}
                  onClick={() => setEditingTx(tx)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 w-full text-left',
                    'active:bg-accent/50 transition-colors',
                    i < group.transactions.length - 1 && 'border-b border-border/40'
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: (cat?.color ?? '#6b7280') + '22' }}
                  >
                    {tx.type === 'transfer' ? '↔️' : (cat?.icon ?? '💸')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {cat?.name ?? (tx.type === 'transfer' ? 'Transfer' : 'Transaction')}
                    </p>
                    {tx.type === 'transfer' ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {from?.name ?? ''} → {toAcc?.name ?? ''}
                      </p>
                    ) : tx.note ? (
                      <p className="text-xs text-muted-foreground truncate">{tx.note}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className={cn('text-sm font-semibold tabular-nums', amountColor)}>
                      {sign}{formatCurrency(tx.amount)}
                    </span>
                    {tx.type !== 'transfer' && (
                      <span className="text-[10px] text-muted-foreground">
                        {from?.name ?? ''}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <AddTransactionSheet
        open={editingTx !== undefined}
        onOpenChange={open => { if (!open) setEditingTx(undefined) }}
        transaction={editingTx ?? undefined}
      />
    </>
  )
}
