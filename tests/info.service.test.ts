// info.service.test.ts — RF21, RF22, RF23, RF24, RN01
import { InfoRepository } from '../src/repositories/info.repository';
import { TripRepository } from '../src/repositories/trip.repository';
import { InfoService } from '../src/services/info.service';
import { NotFoundError, ValidationError } from '../src/types/errors';
import { buildInfo } from './helpers/info.factory';
import { buildTrip } from './helpers/trip.factory';

describe('InfoService', () => {
  let infoRepository: jest.Mocked<InfoRepository>;
  let tripRepository: jest.Mocked<TripRepository>;
  let infoService: InfoService;

  const trip = buildTrip({ id: 'trip-1', userId: 'user-1' });

  beforeEach(() => {
    infoRepository = {
      create: jest.fn(),
      findAllByTrip: jest.fn(),
      findByIdAndTrip: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<InfoRepository>;

    tripRepository = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TripRepository>;

    infoService = new InfoService(infoRepository, tripRepository);
  });

  describe('listInfos', () => {
    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(infoService.listInfos('trip-1', 'user-1')).rejects.toBeInstanceOf(NotFoundError);
      expect(infoRepository.findAllByTrip).not.toHaveBeenCalled();
    });

    it('lista informações da viagem quando o usuário é o dono (RF24)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const infos = [buildInfo()];
      infoRepository.findAllByTrip.mockResolvedValue(infos);

      const result = await infoService.listInfos('trip-1', 'user-1');

      expect(result).toEqual(infos);
    });
  });

  describe('createInfo', () => {
    it('cria informação de voo com dados completos (RF21)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      infoRepository.create.mockResolvedValue(buildInfo());

      await infoService.createInfo('trip-1', 'user-1', {
        type: 'flight',
        title: 'Aegean Airlines',
        date: '2026-03-15',
        details: { origin: 'GRU', destination: 'JTR', time: '06:30', flightNumber: 'A3 1234' },
      });

      expect(infoRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({
          type: 'flight',
          title: 'Aegean Airlines',
          details: { origin: 'GRU', destination: 'JTR', time: '06:30', flightNumber: 'A3 1234' },
        }),
      );
    });

    it('cria informação de hospedagem com check-in e check-out em details (RF22)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      infoRepository.create.mockResolvedValue(buildInfo({ type: 'lodging' }));

      await infoService.createInfo('trip-1', 'user-1', {
        type: 'lodging',
        title: 'Canaves Oia Suites',
        details: {
          address: 'Oia 847 02, Santorini, Grécia',
          checkIn: '2026-03-15',
          checkOut: '2026-03-22',
        },
      });

      expect(infoRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ type: 'lodging', title: 'Canaves Oia Suites' }),
      );
    });

    it('cria informação de documento (RF23)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      infoRepository.create.mockResolvedValue(buildInfo({ type: 'document' }));

      await infoService.createInfo('trip-1', 'user-1', {
        type: 'document',
        title: 'Passaporte',
        date: '2030-01-01',
        description: 'Levar cópia física',
        details: { number: 'FX123456' },
      });

      expect(infoRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ type: 'document', description: 'Levar cópia física' }),
      );
    });

    it('aceita cadastro incremental apenas com título (fluxo alternativo UC05)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      infoRepository.create.mockResolvedValue(buildInfo());

      await infoService.createInfo('trip-1', 'user-1', {
        type: 'flight',
        title: 'Aegean Airlines',
      });

      expect(infoRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({
          title: 'Aegean Airlines',
          description: null,
          date: null,
          details: null,
        }),
      );
    });

    it('lança ValidationError quando nenhum campo é preenchido (fluxo de exceção UC05)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        infoService.createInfo('trip-1', 'user-1', { type: 'flight', title: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(infoRepository.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando o tipo é inválido', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        infoService.createInfo('trip-1', 'user-1', {
          type: 'invalido' as never,
          title: 'Teste',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando a data é inválida', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        infoService.createInfo('trip-1', 'user-1', {
          type: 'flight',
          title: 'Aegean Airlines',
          date: 'não-é-uma-data',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando details não é um objeto', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        infoService.createInfo('trip-1', 'user-1', {
          type: 'flight',
          title: 'Aegean Airlines',
          details: ['não deveria ser array'] as unknown as Record<string, unknown>,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        infoService.createInfo('trip-1', 'user-1', { type: 'flight', title: 'Aegean Airlines' }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(infoRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('updateInfo', () => {
    it('atualiza informação completando campos pendentes (fluxo alternativo UC05)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const updated = buildInfo({ date: new Date('2026-03-15') });
      infoRepository.update.mockResolvedValue(updated);

      const result = await infoService.updateInfo('info-1', 'trip-1', 'user-1', {
        type: 'flight',
        title: 'Aegean Airlines',
        date: '2026-03-15',
      });

      expect(result).toEqual(updated);
    });

    it('lança NotFoundError quando a informação não existe na viagem', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      infoRepository.update.mockResolvedValue(null);

      await expect(
        infoService.updateInfo('info-1', 'trip-1', 'user-1', {
          type: 'flight',
          title: 'Aegean Airlines',
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        infoService.updateInfo('info-1', 'trip-1', 'user-1', {
          type: 'flight',
          title: 'Aegean Airlines',
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(infoRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteInfo', () => {
    it('exclui informação quando a viagem pertence ao usuário', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const info = buildInfo();
      infoRepository.delete.mockResolvedValue(info);

      const result = await infoService.deleteInfo('info-1', 'trip-1', 'user-1');

      expect(result).toEqual(info);
    });

    it('lança NotFoundError quando a informação não existe na viagem', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      infoRepository.delete.mockResolvedValue(null);

      await expect(infoService.deleteInfo('info-1', 'trip-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(infoService.deleteInfo('info-1', 'trip-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(infoRepository.delete).not.toHaveBeenCalled();
    });
  });
});
