import { NavLink, Outlet } from 'react-router-dom'
import { BarChart2, CreditCard, PiggyBank, Settings, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/', label: 'Transactions', icon: CreditCard, end: true },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { to: '/budgets', label: 'Budget', icon: PiggyBank },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex flex-col h-dvh bg-background text-foreground max-w-[430px] mx-auto relative">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex">
          {tabs.map(({ to, label, icon: Icon, end }) => (
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
        </div>
      </nav>
    </div>
  )
}
