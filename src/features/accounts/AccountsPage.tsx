import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil } from 'lucide-react'
import { db, type Account } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import AddAccountSheet from './AddAccountSheet'
import AccountTransactionsView from './AccountTransactionsView'
import { computeBalance } from './AccountTransactionsView'

export default function AccountsPage() {
  const accounts     = useLiveQuery(() => db.accounts.toArray(), [])
  const allTxs       = useLiveQuery(() => db.transactions.toArray(), [])

  const [addOpen,    setAddOpen]    = useState(false)
  const [editingAcc, setEditingAcc] = useState<Account | undefined>(undefined)
  const [viewingAcc, setViewingAcc] = useState<Account | undefined>(undefined)

  const accountsWithBalance = useMemo(() => {
    if (!accounts || !allTxs) return []
    return accounts.map(acc => ({
      acc,
      balance: computeBalance(acc, allTxs),
    }))
  }, [accounts, allTxs])

  const totalBalance = useMemo(
    () => accountsWithBalance.reduce((s, { balance }) => s + balance, 0),
    [accountsWithBalance]
  )

  // Show account transactions view when tapping an account card
  if (viewingAcc) {
    // Re-find the account from live data so edits propagate
    const liveAcc = accounts?.find(a => a.id === viewingAcc.id) ?? viewingAcc
    return (
      <AccountTransactionsView
        account={liveAcc}
        onBack={() => setViewingAcc(undefined)}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4 pb-28">

        {/* Total balance card */}
        <div className="flex flex-col items-center gap-1 py-6 rounded-2xl bg-card border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Balance</p>
          <p className={cn(
            'text-4xl font-bold tabular-nums mt-1',
            totalBalance > 0 ? 'text-green-500'
            : totalBalance < 0 ? 'text-red-400'
            : 'text-foreground'
          )}>
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            across {accountsWithBalance.length} account{accountsWithBalance.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Account list */}
        <div className="flex flex-col gap-2">
          {accountsWithBalance.map(({ acc, balance }) => (
            <button
              key={acc.id}
              onClick={() => setViewingAcc(acc)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-card border text-left active:bg-accent/50 transition-colors w-full"
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: acc.color + '22' }}
              >
                {acc.icon}
              </div>

              {/* Name + type */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{acc.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{acc.type}</p>
              </div>

              {/* Balance */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className={cn(
                  'text-base font-bold tabular-nums',
                  balance > 0 ? 'text-green-500'
                  : balance < 0 ? 'text-red-400'
                  : 'text-foreground'
                )}>
                  {formatCurrency(balance)}
                </p>

                {/* Edit button — stops propagation so tap edit ≠ tap card */}
                <button
                  onClick={e => { e.stopPropagation(); setEditingAcc(acc) }}
                  className="p-1.5 rounded-lg hover:bg-muted active:bg-muted/70 text-muted-foreground transition-colors"
                  aria-label={`Edit ${acc.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </button>
          ))}
        </div>

        {!accounts?.length && (
          <p className="text-center text-sm text-muted-foreground mt-8 select-none">
            No accounts yet. Tap + to add one.
          </p>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setAddOpen(true)}
        aria-label="Add account"
        className="fixed bottom-[4.75rem] right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* Add account sheet */}
      <AddAccountSheet
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Edit account sheet */}
      <AddAccountSheet
        open={!!editingAcc}
        onOpenChange={open => { if (!open) setEditingAcc(undefined) }}
        account={editingAcc}
        onDeleted={() => setEditingAcc(undefined)}
      />
    </>
  )
}
