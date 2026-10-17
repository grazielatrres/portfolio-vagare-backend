import { Expense } from '@prisma/client';
import { CreateExpenseData, ExpenseRepository } from '../repositories/expense.repository';
import { TripRepository } from '../repositories/trip.repository';
import { NotFoundError, ValidationError } from '../types/errors';

const TRIP_NOT_FOUND = 'Viagem não encontrada';
const EXPENSE_NOT_FOUND = 'Gasto não encontrado';

export interface ExpensePayload {
  description: string;
  amount: number;
  currency?: string | null;
  category?: string | null;
}

export class ExpenseService {
  constructor(
    private readonly expenseRepository: ExpenseRepository = new ExpenseRepository(),
    private readonly tripRepository: TripRepository = new TripRepository(),
  ) {}

  async listExpenses(tripId: string, userId: string): Promise<Expense[]> {
    await this.ensureTripAccess(tripId, userId);
    return this.expenseRepository.findAllByTrip(tripId);
  }

  async createExpense(tripId: string, userId: string, data: ExpensePayload): Promise<Expense> {
    const trip = await this.ensureTripAccess(tripId, userId);
    const payload = this.validatePayload(data, trip.currency);
    return this.expenseRepository.create(tripId, payload);
  }

  async updateExpense(
    id: string,
    tripId: string,
    userId: string,
    data: ExpensePayload,
  ): Promise<Expense> {
    const trip = await this.ensureTripAccess(tripId, userId);
    const payload = this.validatePayload(data, trip.currency);

    const expense = await this.expenseRepository.update(id, tripId, payload);
    if (!expense) {
      throw new NotFoundError(EXPENSE_NOT_FOUND);
    }
    return expense;
  }

  async deleteExpense(id: string, tripId: string, userId: string): Promise<Expense> {
    await this.ensureTripAccess(tripId, userId);
    const expense = await this.expenseRepository.delete(id, tripId);
    if (!expense) {
      throw new NotFoundError(EXPENSE_NOT_FOUND);
    }
    return expense;
  }

  private async ensureTripAccess(tripId: string, userId: string) {
    const trip = await this.tripRepository.findByIdAndUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(TRIP_NOT_FOUND);
    }
    return trip;
  }

  private validatePayload(data: ExpensePayload, tripCurrency: string): CreateExpenseData {
    if (!this.hasText(data.description)) {
      throw new ValidationError('Descrição é obrigatória');
    }

    if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0) {
      throw new ValidationError('Valor deve ser maior que zero');
    }

    // O gasto precisa estar na mesma moeda da viagem: o resumo de orçamento soma
    // Expense.amount e Activity.estimatedCost diretamente (RN05), sem conversão
    // cambial, então moedas divergentes quebrariam o cálculo do saldo.
    const currency = data.currency ? data.currency.toUpperCase() : tripCurrency;
    if (currency !== tripCurrency) {
      throw new ValidationError(`A moeda do gasto deve ser a mesma da viagem (${tripCurrency})`);
    }

    return {
      description: data.description.trim(),
      amount: data.amount,
      currency,
      category: this.normalizeText(data.category),
    };
  }

  private hasText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private normalizeText(value?: string | null): string | null {
    if (!value || !value.trim()) {
      return null;
    }
    return value.trim();
  }
}
