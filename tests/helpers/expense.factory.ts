import { Expense } from '@prisma/client';
import { Prisma } from '@prisma/client';

export function buildExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    tripId: 'trip-1',
    description: 'Hospedagem',
    amount: new Prisma.Decimal(500),
    currency: 'BRL',
    category: 'hospedagem',
    ...overrides,
  };
}
