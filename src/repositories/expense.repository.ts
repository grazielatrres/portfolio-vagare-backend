import { Expense, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateExpenseData {
  description: string;
  amount: Prisma.Decimal | number;
  currency?: string;
  category?: string | null;
}

export type UpdateExpenseData = Partial<CreateExpenseData>;

export class ExpenseRepository {
  async create(tripId: string, data: CreateExpenseData): Promise<Expense> {
    return prisma.expense.create({
      data: {
        tripId,
        description: data.description,
        amount: data.amount,
        currency: data.currency ?? 'BRL',
        category: data.category ?? null,
      },
    });
  }

  async findAllByTrip(tripId: string): Promise<Expense[]> {
    return prisma.expense.findMany({
      where: { tripId },
    });
  }

  async findByIdAndTrip(id: string, tripId: string): Promise<Expense | null> {
    return prisma.expense.findFirst({
      where: { id, tripId },
    });
  }

  async update(id: string, tripId: string, data: UpdateExpenseData): Promise<Expense | null> {
    const existing = await this.findByIdAndTrip(id, tripId);
    if (!existing) {
      return null;
    }

    return prisma.expense.update({
      where: { id },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.category !== undefined && { category: data.category }),
      },
    });
  }

  async delete(id: string, tripId: string): Promise<Expense | null> {
    const existing = await this.findByIdAndTrip(id, tripId);
    if (!existing) {
      return null;
    }

    return prisma.expense.delete({
      where: { id },
    });
  }

  async sumByTrip(tripId: string): Promise<number> {
    const result = await prisma.expense.aggregate({
      where: { tripId },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  }
}
