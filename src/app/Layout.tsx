import { useState } from 'react'
import type React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart2, CreditCard, PiggyBank, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActionsContext, type Prefill } from '@/lib/actions'
import AddTransactionSheet from '@/features/transactions/AddTransactionSheet'
import WorthItSheet from '@/features/worthit/WorthItSheet'
import type { Transaction } from '@/lib/db'

type Tab = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean }

const TABS: Tab[] = [
  { to: '/', label: 'Txns', icon: CreditCard, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { to: '/budgets', label: 'Budget', icon: PiggyBank },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const [editingTx, setEditingTx]     = useState<Transaction | null | undefined>(undefined)
  const [worthItOpen, setWorthItOpen] = useState(false)
  const [txPrefill, setTxPrefill]     = useState<Prefill | undefined>()

  const isSheetOpen = editingTx !== undefined || worthItOpen

  function openAddTransaction(prefill?: Prefill) {
    setTxPrefill(prefill)
    setEditingTx(null)
  }

  function openWorthIt() {
    setWorthItOpen(true)
  }

  function handleBuyIt(amount: number, note: string, categoryId?: number) {
    setTxPrefill({ amount, note, categoryId })
    setEditingTx(null)
  }

  return (
    <ActionsContext.Provider value={{ openAddTransaction, openWorthIt, isSheetOpen }}>

      <div className="min-h-dvh bg-background text-foreground">
        <div className="max-w-[430px] mx-auto">
          <main>
            <Outlet />
          </main>
        </div>
      </div>

      {/* ── Fixed bottom nav — 4 equal tabs ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="max-w-[430px] mx-auto flex">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className={cn('font-medium text-[10px] mt-0.5', isActive ? 'text-primary' : 'text-muted-foreground')}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ── Global sheets ── */}
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
