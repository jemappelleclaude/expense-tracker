import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Pencil, ChevronLeft } from 'lucide-react'
import { db, type Account } from '@/lib/db'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import AddAccountSheet from './AddAccountSheet'
import AccountTransactionsView from './AccountTransactionsView'
import { computeBalance } from './AccountTransactionsView'

export default function AccountsPage() {
  const navigate = useNavigate()
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const allTxs   = useLiveQuery(() => db.transactions.toArray(), [])

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

  if (viewingAcc) {
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
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/50 flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-xl hover:bg-accent text-muted-foreground transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-bold text-base">Accounts</h1>
      </div>

      <div className="flex flex-col gap-4 p-4 pb-28">

        {/* Total balance hero card */}
        <div className="rounded-2xl gradient-primary p-6 flex flex-col items-center gap-1 shadow-lg shadow-violet-500/30">
          <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">Total Balance</p>
          <p className="text-4xl font-bold tabular-nums text-white mt-1">
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-xs text-white/50 mt-1">
            across {accountsWithBalance.length} account{accountsWithBalance.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Account list */}
        <div className="flex flex-col gap-2.5">
          {accountsWithBalance.map(({ acc, balance }) => (
            <button
              key={acc.id}
              onClick={() => setViewingAcc(acc)}
              className="flex items-center gap-3.5 p-4 rounded-2xl bg-card border border-border/60 text-left active:bg-accent/30 transition-colors w-full"
            >
              {/* Icon in colored circle */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: acc.color + '28' }}
              >
                {acc.icon}
              </div>

              {/* Name + type */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{acc.name}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{acc.type}</p>
              </div>

              {/* Balance + edit */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className={cn(
                  'text-base font-bold tabular-nums',
                  balance > 0 ? 'text-emerald-500'
                  : balance < 0 ? 'text-red-400'
                  : 'text-foreground'
                )}>
                  {formatCurrency(balance)}
                </p>

                <button
                  onClick={e => { e.stopPropagation(); setEditingAcc(acc) }}
                  className="p-1.5 rounded-xl hover:bg-muted active:bg-muted/70 text-muted-foreground transition-colors"
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
        className="fixed bottom-[4.75rem] right-4 z-40 h-14 w-14 rounded-full gradient-primary text-white shadow-lg shadow-violet-500/40 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <AddAccountSheet
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      <AddAccountSheet
        open={!!editingAcc}
        onOpenChange={open => { if (!open) setEditingAcc(undefined) }}
        account={editingAcc}
        onDeleted={() => setEditingAcc(undefined)}
      />
    </>
  )
}
