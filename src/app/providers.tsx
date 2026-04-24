import { useEffect } from 'react'
import { seedDatabase, processRecurringRules } from '@/lib/db'

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    seedDatabase()
      .then(() => processRecurringRules())
      .catch(console.error)
  }, [])

  return <>{children}</>
}
