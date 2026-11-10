import { Expense } from '@prisma/client';
import { ActivityRepository } from '../repositories/activity.repository';
import { ExpenseRepository } from '../repositories/expense.repository';
import { TripRepository } from '../repositories/trip.repository';
import { NotFoundError } from '../types/errors';

const TRIP_NOT_FOUND = 'Viagem não encontrada';
const UNCATEGORIZED_LABEL = 'Sem categoria';

export interface ActivityCostItem {
  id: string;
  name: string;
  category: string | null;
  estimatedCost: number;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
}

export interface BudgetSummary {
  budget: number | null;
  currency: string;
  activitiesCost: { total: number; items: ActivityCostItem[] };
  expenses: { total: number; items: Expense[] };
  totalSpent: number;
  remainingBalance: number | null;
  byCategory: CategoryBreakdownItem[];
}

export class BudgetService {
  constructor(
    private readonly expenseRepository: ExpenseRepository = new ExpenseRepository(),
    private readonly activityRepository: ActivityRepository = new ActivityRepository(),
    private readonly tripRepository: TripRepository = new TripRepository(),
  ) {}

  async getSummary(tripId: string, userId: string): Promise<BudgetSummary> {
    const trip = await this.ensureTripAccess(tripId, userId);

    const [expenses, activities] = await Promise.all([
      this.expenseRepository.findAllByTrip(tripId),
      this.activityRepository.findAllByTrip(tripId),
    ]);

    // RF18/T08: "gastos do roteiro" — custo estimado das atividades do roteiro
    // entra no total gasto da viagem junto com os gastos manuais (RN05).
    const activityItems: ActivityCostItem[] = activities
      .filter((activity) => activity.estimatedCost !== null)
      .map((activity) => ({
        id: activity.id,
        name: activity.name,
        category: activity.category,
        estimatedCost: Number(activity.estimatedCost),
      }));

    const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const activitiesTotal = activityItems.reduce((sum, item) => sum + item.estimatedCost, 0);
    const totalSpent = expensesTotal + activitiesTotal;

    const budget = trip.budget !== null ? Number(trip.budget) : null;
    const remainingBalance = budget !== null ? budget - totalSpent : null;

    return {
      budget,
      currency: trip.currency,
      activitiesCost: { total: activitiesTotal, items: activityItems },
      expenses: { total: expensesTotal, items: expenses },
      totalSpent,
      remainingBalance,
      byCategory: this.buildCategoryBreakdown(expenses, activityItems),
    };
  }

  private async ensureTripAccess(tripId: string, userId: string) {
    const trip = await this.tripRepository.findByIdAndUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(TRIP_NOT_FOUND);
    }
    return trip;
  }

  private buildCategoryBreakdown(
    expenses: Expense[],
    activityItems: ActivityCostItem[],
  ): CategoryBreakdownItem[] {
    const totals = new Map<string, number>();

    for (const expense of expenses) {
      const key = expense.category?.trim() || UNCATEGORIZED_LABEL;
      totals.set(key, (totals.get(key) ?? 0) + Number(expense.amount));
    }

    for (const item of activityItems) {
      const key = item.category?.trim() || UNCATEGORIZED_LABEL;
      totals.set(key, (totals.get(key) ?? 0) + item.estimatedCost);
    }

    return Array.from(totals.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }
}
