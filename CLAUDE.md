# Expense Tracker PWA

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Dexie.js (IndexedDB) for offline-first local storage
- Recharts for charts
- PWA with service worker

## Project Structure
src/
├── app/              # Routes, layout, providers
├── features/
│   ├── transactions/ # Add/edit/list
│   ├── dashboard/    # Summary + charts
│   ├── categories/   # Manage categories
│   ├── budgets/      # Budget tracking
│   ├── accounts/     # Wallets
│   └── settings/     # Export, sync, theme
├── lib/
│   ├── db/           # Dexie schema, seed data
│   └── utils/        # Formatters, constants
└── components/       # Shared UI components

## Conventions
- Functional components only, named exports
- Use async/await, no .then() chains
- Mobile-first (380px base), bottom tab navigation
- All data offline-first via IndexedDB
- INR as default currency
- Dark mode support via Tailwind dark: classes

## Default Categories
Expense: Food, Transport, Shopping, Rent, Bills, Entertainment, Health, Education, Personal, Other
Income: Salary, Freelance, Investment, Gift, Other