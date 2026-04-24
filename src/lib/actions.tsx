import { createContext, useContext } from 'react'

export interface Prefill {
  amount?: number
  categoryId?: number
  note?: string
}

export interface ActionsContextValue {
  openAddTransaction: (prefill?: Prefill) => void
  openWorthIt: () => void
}

export const ActionsContext = createContext<ActionsContextValue | null>(null)

export function useActions(): ActionsContextValue {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useActions must be used within ActionsContext.Provider')
  return ctx
}
