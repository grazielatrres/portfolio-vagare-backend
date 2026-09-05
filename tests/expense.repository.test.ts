// expense.repository.test.ts — RF18, RF20, RN05

import { prisma } from '../src/config/prisma';
import { ExpenseRepository } from '../src/repositories/expense.repository';
import { buildExpense } from './helpers/expense.factory';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    expense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

const prismaExpense = prisma.expense as unknown as {
  create: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  aggregate: jest.Mock;
};

describe('ExpenseRepository', () => {
  const repository = new ExpenseRepository();
  const tripId = 'trip-1';
  const otherTripId = 'trip-2';

  describe('create', () => {
    it('cria gasto vinculando obrigatoriamente o tripId', async () => {
      const data = {
        description: 'Hospedagem',
        amount: 500,
        category: 'hospedagem',
      };
      prismaExpense.create.mockResolvedValue(buildExpense());

      const result = await repository.create(tripId, data);

      expect(prismaExpense.create).toHaveBeenCalledWith({
        data: {
          tripId,
          description: data.description,
          amount: data.amount,
          currency: 'BRL',
          category: data.category,
        },
      });
      expect(result.tripId).toBe(tripId);
    });

    it('usa BRL como moeda padrão quando não informada', async () => {
      prismaExpense.create.mockResolvedValue(buildExpense());

      await repository.create(tripId, { description: 'Almoço', amount: 50 });

      expect(prismaExpense.create).toHaveBeenCalledWith({
        data: {
          tripId,
          description: 'Almoço',
          amount: 50,
          currency: 'BRL',
          category: null,
        },
      });
    });
  });

  describe('findAllByTrip', () => {
    it('lista apenas gastos filtrados pelo tripId', async () => {
      const expenses = [buildExpense(), buildExpense({ id: 'expense-2' })];
      prismaExpense.findMany.mockResolvedValue(expenses);

      const result = await repository.findAllByTrip(tripId);

      expect(prismaExpense.findMany).toHaveBeenCalledWith({ where: { tripId } });
      expect(result).toEqual(expenses);
    });
  });

  describe('findByIdAndTrip', () => {
    it('busca gasto por id e tripId juntos', async () => {
      const expense = buildExpense();
      prismaExpense.findFirst.mockResolvedValue(expense);

      const result = await repository.findByIdAndTrip('expense-1', tripId);

      expect(prismaExpense.findFirst).toHaveBeenCalledWith({
        where: { id: 'expense-1', tripId },
      });
      expect(result).toEqual(expense);
    });

    it('retorna null quando o gasto não existe ou não pertence à viagem', async () => {
      prismaExpense.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdAndTrip('expense-1', otherTripId);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('atualiza somente se o gasto pertencer à viagem', async () => {
      const existing = buildExpense();
      const updated = buildExpense({ description: 'Hospedagem editada' });
      prismaExpense.findFirst.mockResolvedValue(existing);
      prismaExpense.update.mockResolvedValue(updated);

      const result = await repository.update('expense-1', tripId, {
        description: 'Hospedagem editada',
      });

      expect(prismaExpense.update).toHaveBeenCalledWith({
        where: { id: 'expense-1' },
        data: { description: 'Hospedagem editada' },
      });
      expect(result).toEqual(updated);
    });

    it('não chama update e retorna null se o gasto não pertencer à viagem', async () => {
      prismaExpense.findFirst.mockResolvedValue(null);

      const result = await repository.update('expense-1', otherTripId, { amount: 10 });

      expect(prismaExpense.update).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('exclui somente se o gasto pertencer à viagem', async () => {
      const existing = buildExpense();
      prismaExpense.findFirst.mockResolvedValue(existing);
      prismaExpense.delete.mockResolvedValue(existing);

      const result = await repository.delete('expense-1', tripId);

      expect(prismaExpense.delete).toHaveBeenCalledWith({ where: { id: 'expense-1' } });
      expect(result).toEqual(existing);
    });

    it('não chama delete e retorna null se o gasto não pertencer à viagem', async () => {
      prismaExpense.findFirst.mockResolvedValue(null);

      const result = await repository.delete('expense-1', otherTripId);

      expect(prismaExpense.delete).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('sumByTrip', () => {
    it('soma os valores dos gastos da viagem', async () => {
      prismaExpense.aggregate.mockResolvedValue({ _sum: { amount: 750 } });

      const result = await repository.sumByTrip(tripId);

      expect(prismaExpense.aggregate).toHaveBeenCalledWith({
        where: { tripId },
        _sum: { amount: true },
      });
      expect(result).toBe(750);
    });

    it('retorna 0 quando a viagem não tem gastos', async () => {
      prismaExpense.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const result = await repository.sumByTrip(tripId);

      expect(result).toBe(0);
    });
  });
});
