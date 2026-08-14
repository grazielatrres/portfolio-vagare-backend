
import { TripRepository } from '../src/repositories/trip.repository';
import { TripService } from '../src/services/trip.service';
import { NotFoundError, ValidationError } from '../src/types/errors';
import { buildTrip } from './helpers/trip.factory';

const validPayload = {
  name: 'Férias em Florença',
  destination: 'Florença, Itália',
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-09-10'),
  budget: 5000,
  numberOfPeople: 2,
};

describe('TripService', () => {
  let tripRepository: jest.Mocked<TripRepository>;
  let tripService: TripService;

  beforeEach(() => {
    tripRepository = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TripRepository>;

    tripService = new TripService(tripRepository);
  });

  describe('createTrip', () => {
    it('cria viagem com dados válidos', async () => {
      const created = buildTrip({ numberOfPeople: 2 });
      tripRepository.create.mockResolvedValue(created);

      const result = await tripService.createTrip('user-1', validPayload);

      expect(tripRepository.create).toHaveBeenCalledWith('user-1', {
        name: validPayload.name,
        destination: validPayload.destination,
        startDate: validPayload.startDate,
        endDate: validPayload.endDate,
        budget: validPayload.budget,
        numberOfPeople: validPayload.numberOfPeople,
      });
      expect(result).toEqual(created);
    });

    it('aceita endDate igual a startDate', async () => {
      const sameDay = {
        ...validPayload,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-01'),
      };
      tripRepository.create.mockResolvedValue(
        buildTrip({
          startDate: sameDay.startDate,
          endDate: sameDay.endDate,
        }),
      );

      await tripService.createTrip('user-1', sameDay);

      expect(tripRepository.create).toHaveBeenCalled();
    });

    it('lança ValidationError quando falta name', async () => {
      await expect(
        tripService.createTrip('user-1', { ...validPayload, name: '' }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(tripRepository.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando falta destination', async () => {
      await expect(
        tripService.createTrip('user-1', { ...validPayload, destination: '   ' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando falta startDate', async () => {
      await expect(
        tripService.createTrip('user-1', {
          ...validPayload,
          startDate: undefined as unknown as Date,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando endDate é anterior a startDate', async () => {
      await expect(
        tripService.createTrip('user-1', {
          ...validPayload,
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-01'),
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(tripRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('listTrips', () => {
    it('lista viagens do usuário', async () => {
      const trips = [buildTrip()];
      tripRepository.findAllByUser.mockResolvedValue(trips);

      const result = await tripService.listTrips('user-1');

      expect(tripRepository.findAllByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(trips);
    });
  });

  describe('getTrip', () => {
    it('retorna a viagem quando pertence ao usuário', async () => {
      const trip = buildTrip();
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      const result = await tripService.getTrip('trip-1', 'user-1');

      expect(tripRepository.findByIdAndUser).toHaveBeenCalledWith('trip-1', 'user-1');
      expect(result).toEqual(trip);
    });

    it('lança NotFoundError quando a viagem não existe ou é de outro usuário', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(tripService.getTrip('trip-1', 'user-2')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('updateTrip', () => {
    it('atualiza viagem com dados válidos', async () => {
      const updated = buildTrip({ name: 'Toscana 2026' });
      tripRepository.update.mockResolvedValue(updated);

      const result = await tripService.updateTrip('trip-1', 'user-1', {
        ...validPayload,
        name: 'Toscana 2026',
      });

      expect(tripRepository.update).toHaveBeenCalledWith(
        'trip-1',
        'user-1',
        expect.objectContaining({ name: 'Toscana 2026' }),
      );
      expect(result).toEqual(updated);
    });

    it('lança ValidationError quando endDate é anterior a startDate', async () => {
      await expect(
        tripService.updateTrip('trip-1', 'user-1', {
          ...validPayload,
          startDate: new Date('2026-09-10'),
          endDate: new Date('2026-09-01'),
        }),
      ).rejects.toBeInstanceOf(ValidationError);

      expect(tripRepository.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundError quando a viagem é de outro usuário', async () => {
      tripRepository.update.mockResolvedValue(null);

      await expect(tripService.updateTrip('trip-1', 'user-2', validPayload)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('deleteTrip', () => {
    it('exclui viagem do usuário', async () => {
      const trip = buildTrip();
      tripRepository.delete.mockResolvedValue(trip);

      const result = await tripService.deleteTrip('trip-1', 'user-1');

      expect(tripRepository.delete).toHaveBeenCalledWith('trip-1', 'user-1');
      expect(result).toEqual(trip);
    });

    it('lança NotFoundError quando a viagem é de outro usuário', async () => {
      tripRepository.delete.mockResolvedValue(null);

      await expect(tripService.deleteTrip('trip-1', 'user-2')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
