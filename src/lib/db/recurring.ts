import { db, type RecurrenceFrequency } from './schema'

// Module-level guard: set synchronously so StrictMode's double-invoke can't
// slip through the race window before the first async step.
const _today = new Date().toISOString().slice(0, 10)
let _ranToday = localStorage.getItem('recurringLastProcessed') === _today

function advance(date: Date, freq: RecurrenceFrequency): Date {
  const d = new Date(date)
  if (freq === 'daily')   d.setDate(d.getDate() + 1)
  if (freq === 'weekly')  d.setDate(d.getDate() + 7)
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1)
  if (freq === 'yearly')  d.setFullYear(d.getFullYear() + 1)
  return d
}

export async function processRecurringRules(): Promise<void> {
  if (_ranToday) return
  _ranToday = true

  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  try {
    const rules = await db.recurringRules.toArray()
    for (const rule of rules) {
      let next = new Date(rule.nextDate)
      const end = rule.endDate ? new Date(rule.endDate) : null

      while (next <= todayEnd && (!end || next <= end)) {
        const now = new Date()
        await db.transactions.add({
          type:            rule.transactionTemplate.type,
          amount:          rule.transactionTemplate.amount,
          categoryId:      rule.transactionTemplate.categoryId,
          accountId:       rule.transactionTemplate.accountId,
          toAccountId:     rule.transactionTemplate.toAccountId,
          note:            rule.transactionTemplate.note,
          date:            new Date(next),
          isRecurring:     true,
          recurringRuleId: rule.id,
          createdAt:       now,
          updatedAt:       now,
        })
        next = advance(next, rule.frequency)
      }

      await db.recurringRules.update(rule.id!, { nextDate: next })
    }
    localStorage.setItem('recurringLastProcessed', _today)
  } catch (err) {
    _ranToday = false // allow retry on next load if something failed
    throw err
  }
}
