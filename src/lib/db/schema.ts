import Dexie, { type Table } from 'dexie'

export type TransactionType = 'expense' | 'income' | 'transfer'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Category {
  id?: number
  name: string
  type: TransactionType
  icon: string
  color: string
  isDefault: boolean
  createdAt: Date
}

export interface Account {
  id?: number
  name: string
  type: 'cash' | 'bank' | 'credit' | 'investment' | 'other'
  balance: number
  openingBalance: number
  currency: string
  color: string
  icon: string
  isDefault: boolean
  createdAt: Date
}

export interface Transaction {
  id?: number
  type: TransactionType
  amount: number
  categoryId: number
  accountId: number
  toAccountId?: number
  date: Date
  note: string
  isRecurring: boolean
  recurringRuleId?: number
  createdAt: Date
  updatedAt: Date
}

export interface Budget {
  id?: number
  categoryId: number
  monthlyLimit: number
  month: string // "YYYY-MM"
}

export interface RecurringRule {
  id?: number
  transactionTemplate: {
    type: TransactionType
    amount: number
    categoryId: number
    accountId: number
    toAccountId?: number
    note: string
  }
  frequency: RecurrenceFrequency
  nextDate: Date
  endDate?: Date
}

export class ExpenseTrackerDB extends Dexie {
  transactions!: Table<Transaction>
  categories!: Table<Category>
  accounts!: Table<Account>
  budgets!: Table<Budget>
  recurringRules!: Table<RecurringRule>

  constructor() {
    super('ExpenseTrackerDB')
    this.version(1).stores({
      transactions: '++id, type, categoryId, accountId, toAccountId, date, recurringRuleId, createdAt',
      categories: '++id, name, type, isDefault',
      accounts: '++id, name, type, isDefault',
      budgets: '++id, categoryId, period, startDate',
      recurringRules: '++id, type, categoryId, accountId, frequency, isActive, lastApplied'
    })
    this.version(2).stores({
      transactions: '++id, type, categoryId, accountId, toAccountId, date, isRecurring, recurringRuleId, createdAt',
      categories: '++id, name, type, isDefault',
      accounts: '++id, name, type, isDefault',
      budgets: '++id, categoryId, month',
      recurringRules: '++id, frequency, nextDate, endDate'
    })
    // v3: clears all data so the fixed seed runs fresh
    this.version(3)
      .stores({
        transactions: '++id, type, categoryId, accountId, toAccountId, date, isRecurring, recurringRuleId, createdAt',
        categories: '++id, name, type, isDefault',
        accounts: '++id, name, type, isDefault',
        budgets: '++id, categoryId, month',
        recurringRules: '++id, frequency, nextDate, endDate'
      })
      .upgrade(tx => Promise.all([
        tx.table('transactions').clear(),
        tx.table('categories').clear(),
        tx.table('accounts').clear(),
        tx.table('budgets').clear(),
        tx.table('recurringRules').clear(),
      ]))
    // v4: re-seeds with 3 default accounts (Cash, Bank, Card)
    this.version(4).upgrade(tx => Promise.all([
      tx.table('transactions').clear(),
      tx.table('categories').clear(),
      tx.table('accounts').clear(),
      tx.table('budgets').clear(),
      tx.table('recurringRules').clear(),
    ]))
    // v5: adds openingBalance field to accounts (non-destructive)
    this.version(5).upgrade(tx =>
      tx.table('accounts').toCollection().modify((acc: Account) => {
        if (acc.openingBalance === undefined) acc.openingBalance = acc.balance ?? 0
      })
    )
  }
}

export const db = new ExpenseTrackerDB()
