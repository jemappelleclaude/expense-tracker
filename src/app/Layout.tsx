import { useState } from 'react'
import type React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart2, CreditCard, PiggyBank, Settings, Plus, X, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActionsContext, type Prefill } from '@/lib/actions'
import AddTransactionSheet from '@/features/transactions/AddTransactionSheet'
import WorthItSheet from '@/features/worthit/WorthItSheet'
import type { Transaction } from '@/lib/db'

type Tab = { to: string; label: string; icon: React.FC<{ className?: string }>; end?: boolean }

const LEFT_TABS: Tab[] = [
  { to: '/', label: 'Transactions', icon: CreditCard, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
]

const RIGHT_TABS: Tab[] = [
  { to: '/budgets', label: 'Budget', icon: PiggyBank },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  // undefined = closed, null = add mode
  const [editingTx, setEditingTx]   = useState<Transaction | null | undefined>(undefined)
  const [worthItOpen, setWorthItOpen] = useState(false)
  const [txPrefill, setTxPrefill]   = useState<Prefill | undefined>()
  const [fabOpen, setFabOpen]       = useState(false)

  function openAddTransaction(prefill?: Prefill) {
    setTxPrefill(prefill)
    setEditingTx(null)
    setFabOpen(false)
  }

  function openWorthIt() {
    setWorthItOpen(true)
    setFabOpen(false)
  }

  function handleBuyIt(amount: number, note: string, categoryId?: number) {
    setTxPrefill({ amount, note, categoryId })
    setEditingTx(null)
  }

  return (
    <ActionsContext.Provider value={{ openAddTransaction, openWorthIt }}>
      <div className="flex flex-col h-dvh bg-background text-foreground max-w-[430px] mx-auto relative">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex">
            {LEFT_TABS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                    <span className={cn('font-medium', isActive && 'text-primary')}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}

            {/* Center placeholder for raised FAB */}
            <div className="flex-1" />

            {RIGHT_TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                    <span className={cn('font-medium', isActive && 'text-primary')}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {/* Backdrop */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* Action menu — appears above the FAB */}
      {fabOpen && (
        <div className="fixed bottom-[5.5rem] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3">
          <button
            onClick={openWorthIt}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-popover border shadow-lg text-sm font-semibold text-popover-foreground active:scale-95 transition-transform whitespace-nowrap"
          >
            <Scale className="h-4 w-4 text-primary" />
            Worth It?
          </button>
          <button
            onClick={() => openAddTransaction()}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-popover border shadow-lg text-sm font-semibold text-popover-foreground active:scale-95 transition-transform whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-primary" />
            Add Transaction
          </button>
        </div>
      )}

      {/* Center raised FAB */}
      <button
        onClick={() => setFabOpen(f => !f)}
        aria-label="Actions"
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
          'h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg',
          'border-4 border-background',
          'flex items-center justify-center active:scale-95 transition-all duration-200'
        )}
      >
        {fabOpen
          ? <X className="h-6 w-6" />
          : <Plus className="h-6 w-6" strokeWidth={2.5} />
        }
      </button>

      {/* Global sheets */}
      <AddTransactionSheet
        open={editingTx !== undefined}
        onOpenChange={open => { if (!open) { setEditingTx(undefined); setTxPrefill(undefined) } }}
        transaction={editingTx ?? undefined}
        prefill={txPrefill}
      />

      <WorthItSheet
        open={worthItOpen}
        onOpenChange={setWorthItOpen}
        onBuyIt={handleBuyIt}
      />
    </ActionsContext.Provider>
  )
}
