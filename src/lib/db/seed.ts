import { db } from './schema'

const defaultCategories = [
  // Expense categories
  { name: 'Food',          type: 'expense' as const, icon: '🍔', color: '#f97316', isDefault: true },
  { name: 'Transport',     type: 'expense' as const, icon: '🚗', color: '#3b82f6', isDefault: true },
  { name: 'Shopping',      type: 'expense' as const, icon: '🛒', color: '#8b5cf6', isDefault: true },
  { name: 'Rent',          type: 'expense' as const, icon: '🏠', color: '#ef4444', isDefault: true },
  { name: 'Bills',         type: 'expense' as const, icon: '💡', color: '#f59e0b', isDefault: true },
  { name: 'Entertainment', type: 'expense' as const, icon: '🎬', color: '#ec4899', isDefault: true },
  { name: 'Health',        type: 'expense' as const, icon: '💊', color: '#10b981', isDefault: true },
  { name: 'Education',     type: 'expense' as const, icon: '📚', color: '#6366f1', isDefault: true },
  { name: 'Personal',      type: 'expense' as const, icon: '✂️', color: '#14b8a6', isDefault: true },
  { name: 'Other',         type: 'expense' as const, icon: '📦', color: '#6b7280', isDefault: true },
  // Income categories
  { name: 'Salary',     type: 'income' as const, icon: '💰', color: '#22c55e', isDefault: true },
  { name: 'Freelance',  type: 'income' as const, icon: '💼', color: '#06b6d4', isDefault: true },
  { name: 'Investment', type: 'income' as const, icon: '📈', color: '#a855f7', isDefault: true },
  { name: 'Gift',       type: 'income' as const, icon: '🎁', color: '#f43f5e', isDefault: true },
  { name: 'Other',      type: 'income' as const, icon: '📦', color: '#84cc16', isDefault: true },
]

const defaultAccounts = [
  { name: 'Cash', type: 'cash'   as const, icon: '💵', color: '#22c55e', isDefault: true },
  { name: 'Bank', type: 'bank'   as const, icon: '🏦', color: '#3b82f6', isDefault: true },
  { name: 'Card', type: 'credit' as const, icon: '💳', color: '#8b5cf6', isDefault: true },
]

export async function seedDatabase() {
  // Single rw transaction — serializes React StrictMode's double useEffect
  // invocation so the second call always sees count > 0 and exits early.
  // Categories and accounts are checked independently so neither can be
  // missing if the other already exists.
  await db.transaction('rw', db.categories, db.accounts, async () => {
    const now = new Date()

    if (await db.categories.count() === 0) {
      await db.categories.bulkAdd(
        defaultCategories.map(c => ({ ...c, createdAt: now }))
      )
    }

    if (await db.accounts.count() === 0) {
      await db.accounts.bulkAdd(
        defaultAccounts.map(a => ({ ...a, balance: 0, openingBalance: 0, currency: 'INR', createdAt: now }))
      )
    }
  })
}
