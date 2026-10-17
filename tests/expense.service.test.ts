// expense.service.test.ts — RF18, RN01
import { ExpenseRepository } from '../src/repositories/expense.repository';
import { TripRepository } from '../src/repositories/trip.repository';
import { ExpenseService } from '../src/services/expense.service';
import { NotFoundError, ValidationError } from '../src/types/errors';
import { buildExpense } from './helpers/expense.factory';
import { buildTrip } from './helpers/trip.factory';

describe('ExpenseService', () => {
  let expenseRepository: jest.Mocked<ExpenseRepository>;
  let tripRepository: jest.Mocked<TripRepository>;
  let expenseService: ExpenseService;

  const trip = buildTrip({ id: 'trip-1', userId: 'user-1' });

  const validPayload = {
    description: 'Hospedagem',
    amount: 500,
    currency: 'BRL',
    category: 'Hospedagem',
  };

  beforeEach(() => {
    expenseRepository = {
      create: jest.fn(),
      findAllByTrip: jest.fn(),
      findByIdAndTrip: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      sumByTrip: jest.fn(),
    } as unknown as jest.Mocked<ExpenseRepository>;

    tripRepository = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TripRepository>;

    expenseService = new ExpenseService(expenseRepository, tripRepository);
  });

  describe('listExpenses', () => {
    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(expenseService.listExpenses('trip-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(expenseRepository.findAllByTrip).not.toHaveBeenCalled();
    });

    it('lista gastos da viagem quando o usuário é o dono', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const expenses = [buildExpense()];
      expenseRepository.findAllByTrip.mockResolvedValue(expenses);

      const result = await expenseService.listExpenses('trip-1', 'user-1');

      expect(result).toEqual(expenses);
    });
  });

  describe('createExpense', () => {
    it('cria gasto com dados válidos (RF18)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      expenseRepository.create.mockResolvedValue(buildExpense());

      await expenseService.createExpense('trip-1', 'user-1', validPayload);

      expect(expenseRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({
          description: 'Hospedagem',
          amount: 500,
          currency: 'BRL',
          category: 'Hospedagem',
        }),
      );
    });

    it('aceita payload sem categoria (fluxo alternativo RF18)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      expenseRepository.create.mockResolvedValue(buildExpense());

      await expenseService.createExpense('trip-1', 'user-1', {
        description: 'Almoço',
        amount: 50,
      });

      expect(expenseRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ description: 'Almoço', category: null, currency: 'BRL' }),
      );
    });

    it('lança ValidationError quando falta a descrição (fluxo de exceção RF18)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        expenseService.createExpense('trip-1', 'user-1', { ...validPayload, description: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(expenseRepository.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando o valor não é informado (fluxo de exceção RF18)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        expenseService.createExpense('trip-1', 'user-1', {
          ...validPayload,
          amount: undefined as unknown as number,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(expenseRepository.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando o valor é zero ou negativo', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        expenseService.createExpense('trip-1', 'user-1', { ...validPayload, amount: -10 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando a moeda do gasto diverge da moeda da viagem', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        expenseService.createExpense('trip-1', 'user-1', { ...validPayload, currency: 'USD' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(expenseRepository.create).not.toHaveBeenCalled();
    });

    it('usa a moeda da viagem quando o gasto não informa moeda', async () => {
      const eurTrip = buildTrip({ id: 'trip-2', userId: 'user-1', currency: 'EUR' });
      tripRepository.findByIdAndUser.mockResolvedValue(eurTrip);
      expenseRepository.create.mockResolvedValue(buildExpense({ currency: 'EUR' }));

      await expenseService.createExpense('trip-2', 'user-1', {
        description: 'Jantar',
        amount: 40,
      });

      expect(expenseRepository.create).toHaveBeenCalledWith(
        'trip-2',
        expect.objectContaining({ currency: 'EUR' }),
      );
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        expenseService.createExpense('trip-1', 'user-1', validPayload),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(expenseRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateExpense', () => {
    it('atualiza gasto com dados válidos', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const updated = buildExpense({ description: 'Hospedagem editada' });
      expenseRepository.update.mockResolvedValue(updated);

      const result = await expenseService.updateExpense(
        'expense-1',
        'trip-1',
        'user-1',
        validPayload,
      );

      expect(result).toEqual(updated);
    });

    it('lança NotFoundError quando o gasto não existe na viagem', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      expenseRepository.update.mockResolvedValue(null);

      await expect(
        expenseService.updateExpense('expense-1', 'trip-1', 'user-1', validPayload),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        expenseService.updateExpense('expense-1', 'trip-1', 'user-1', validPayload),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(expenseRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteExpense', () => {
    it('exclui gasto quando a viagem pertence ao usuário', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const expense = buildExpense();
      expenseRepository.delete.mockResolvedValue(expense);

      const result = await expenseService.deleteExpense('expense-1', 'trip-1', 'user-1');

      expect(result).toEqual(expense);
    });

    it('lança NotFoundError quando o gasto não existe na viagem', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      expenseRepository.delete.mockResolvedValue(null);

      await expect(
        expenseService.deleteExpense('expense-1', 'trip-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        expenseService.deleteExpense('expense-1', 'trip-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(expenseRepository.delete).not.toHaveBeenCalled();
    });
  });
});
