import { useState } from 'react'
import type React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart2, CreditCard, PiggyBank, Settings, Plus, X, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActionsContext, type Prefill } from '@/lib/actions'
import AddTransactionSheet from '@/features/transactions/AddTransactionSheet'
import WorthItSheet from '@/features/worthit/WorthItSheet'
import type { Transaction } from '@/lib/db'

type Tab = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean }

const LEFT_TABS: Tab[] = [
  { to: '/', label: 'Txns', icon: CreditCard, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
]

const RIGHT_TABS: Tab[] = [
  { to: '/budgets', label: 'Budget', icon: PiggyBank },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const [editingTx, setEditingTx]     = useState<Transaction | null | undefined>(undefined)
  const [worthItOpen, setWorthItOpen] = useState(false)
  const [txPrefill, setTxPrefill]     = useState<Prefill | undefined>()
  const [fabOpen, setFabOpen]         = useState(false)

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

      <div className="min-h-dvh bg-background text-foreground">
        <div className="max-w-[430px] mx-auto">
          <main>
            <Outlet />
          </main>
        </div>
      </div>

      {/* ── Fixed bottom nav ── z-50 ── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="max-w-[430px] mx-auto flex">
          {LEFT_TABS.map(({ to, label, icon: Icon, end }) => (
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

          {/* Center gap — FAB overlaps here */}
          <div className="flex-1" />

          {RIGHT_TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
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

      {/* ── FAB backdrop ── */}
      {fabOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* ── Action menu — above FAB ── */}
      {fabOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[65] flex flex-col items-center gap-3">
          <button
            onClick={openWorthIt}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-card border border-border shadow-lg shadow-black/10 text-sm font-semibold text-foreground active:scale-95 transition-transform whitespace-nowrap"
          >
            <Scale className="h-4 w-4 text-primary" />
            Worth It?
          </button>
          <button
            onClick={() => openAddTransaction()}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-card border border-border shadow-lg shadow-black/10 text-sm font-semibold text-foreground active:scale-95 transition-transform whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-primary" />
            Add Transaction
          </button>
        </div>
      )}

      {/*
        ── Center raised FAB ──
        - z-[60]: above nav (z-50) so it's never clipped
        - bottom-7 (28px): centers the 56px FAB on the nav's top edge
          Nav ≈ 56px tall → top edge ≈ 56px from screen bottom
          FAB center = bottom + radius = 28 + 28 = 56px ✓
        - No border-background ring: just shadow for lift
      */}
      <button
        onClick={() => setFabOpen(f => !f)}
        aria-label="Actions"
        className={cn(
          'fixed bottom-7 left-1/2 -translate-x-1/2 z-[60]',
          'h-14 w-14 rounded-full gradient-primary text-white',
          'shadow-xl shadow-violet-500/40',
          'flex items-center justify-center active:scale-95 transition-all duration-200'
        )}
      >
        {fabOpen
          ? <X className="h-6 w-6" />
          : <Plus className="h-6 w-6" strokeWidth={2.5} />
        }
      </button>

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
