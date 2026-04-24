import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './Layout'
import TransactionsPage from '@/features/transactions/TransactionsPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import BudgetsPage from '@/features/budgets/BudgetsPage'
import AccountsPage from '@/features/accounts/AccountsPage'
import SettingsPage from '@/features/settings/SettingsPage'

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <TransactionsPage /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'budgets', element: <BudgetsPage /> },
        { path: 'accounts', element: <AccountsPage /> },
        { path: 'settings', element: <SettingsPage /> },
      ]
    }
  ],
  { basename: import.meta.env.BASE_URL }
)

export default function AppRouter() {
  return <RouterProvider router={router} />
}
