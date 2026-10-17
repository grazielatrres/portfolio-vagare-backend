// budget.service.test.ts — RF17, RF19, RF20, RN01, RN05, RN06

import { Prisma } from '@prisma/client';
import { ActivityRepository } from '../src/repositories/activity.repository';
import { ExpenseRepository } from '../src/repositories/expense.repository';
import { TripRepository } from '../src/repositories/trip.repository';
import { BudgetService } from '../src/services/budget.service';
import { NotFoundError } from '../src/types/errors';
import { buildActivity } from './helpers/activity.factory';
import { buildExpense } from './helpers/expense.factory';
import { buildTrip } from './helpers/trip.factory';

describe('BudgetService', () => {
  let expenseRepository: jest.Mocked<ExpenseRepository>;
  let activityRepository: jest.Mocked<ActivityRepository>;
  let tripRepository: jest.Mocked<TripRepository>;
  let budgetService: BudgetService;

  beforeEach(() => {
    expenseRepository = {
      create: jest.fn(),
      findAllByTrip: jest.fn(),
      findByIdAndTrip: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      sumByTrip: jest.fn(),
    } as unknown as jest.Mocked<ExpenseRepository>;

    activityRepository = {
      create: jest.fn(),
      findAllByTrip: jest.fn(),
      findByIdAndTrip: jest.fn(),
      findByTripDateAndTime: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    tripRepository = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TripRepository>;

    budgetService = new BudgetService(expenseRepository, activityRepository, tripRepository);
  });

  it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
    tripRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(budgetService.getSummary('trip-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(expenseRepository.findAllByTrip).not.toHaveBeenCalled();
  });

  it('soma gastos manuais e custo estimado das atividades no total gasto (RF18, T08)', async () => {
    const trip = buildTrip({
      id: 'trip-1',
      userId: 'user-1',
      budget: new Prisma.Decimal(2000),
      currency: 'BRL',
    });
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    expenseRepository.findAllByTrip.mockResolvedValue([
      buildExpense({ amount: new Prisma.Decimal(500), category: 'Hospedagem' }),
    ]);
    activityRepository.findAllByTrip.mockResolvedValue([
      buildActivity({ estimatedCost: new Prisma.Decimal(95), category: 'Praia' }),
      buildActivity({ id: 'activity-2', estimatedCost: null }),
    ]);

    const result = await budgetService.getSummary('trip-1', 'user-1');

    expect(result.expenses.total).toBe(500);
    expect(result.activitiesCost.total).toBe(95);
    expect(result.totalSpent).toBe(595);
    expect(result.activitiesCost.items).toHaveLength(1);
  });

  it('calcula o saldo restante automaticamente a partir do orçamento (RF19, RN05)', async () => {
    const trip = buildTrip({
      id: 'trip-1',
      userId: 'user-1',
      budget: new Prisma.Decimal(1000),
    });
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    expenseRepository.findAllByTrip.mockResolvedValue([
      buildExpense({ amount: new Prisma.Decimal(300) }),
    ]);
    activityRepository.findAllByTrip.mockResolvedValue([]);

    const result = await budgetService.getSummary('trip-1', 'user-1');

    expect(result.remainingBalance).toBe(700);
  });

  it('retorna saldo negativo sem bloquear quando os gastos ultrapassam o orçamento (RN06)', async () => {
    const trip = buildTrip({ id: 'trip-1', userId: 'user-1', budget: new Prisma.Decimal(100) });
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    expenseRepository.findAllByTrip.mockResolvedValue([
      buildExpense({ amount: new Prisma.Decimal(150) }),
    ]);
    activityRepository.findAllByTrip.mockResolvedValue([]);

    const result = await budgetService.getSummary('trip-1', 'user-1');

    expect(result.remainingBalance).toBe(-50);
  });

  it('retorna saldo nulo quando a viagem não tem orçamento definido', async () => {
    const trip = buildTrip({ id: 'trip-1', userId: 'user-1', budget: null });
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    expenseRepository.findAllByTrip.mockResolvedValue([]);
    activityRepository.findAllByTrip.mockResolvedValue([]);

    const result = await budgetService.getSummary('trip-1', 'user-1');

    expect(result.budget).toBeNull();
    expect(result.remainingBalance).toBeNull();
  });

  it('agrupa gastos e atividades por categoria (RF20)', async () => {
    const trip = buildTrip({ id: 'trip-1', userId: 'user-1' });
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    expenseRepository.findAllByTrip.mockResolvedValue([
      buildExpense({ amount: new Prisma.Decimal(500), category: 'Hospedagem' }),
      buildExpense({ id: 'expense-2', amount: new Prisma.Decimal(100), category: 'Hospedagem' }),
      buildExpense({ id: 'expense-3', amount: new Prisma.Decimal(80), category: null }),
    ]);
    activityRepository.findAllByTrip.mockResolvedValue([
      buildActivity({ estimatedCost: new Prisma.Decimal(95), category: 'Praia' }),
    ]);

    const result = await budgetService.getSummary('trip-1', 'user-1');

    expect(result.byCategory).toEqual(
      expect.arrayContaining([
        { category: 'Hospedagem', total: 600 },
        { category: 'Praia', total: 95 },
        { category: 'Sem categoria', total: 80 },
      ]),
    );
  });
});
