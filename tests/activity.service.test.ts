// activity.service.test.ts — RF12, RF13, RN01, RN07
import { ActivityRepository } from '../src/repositories/activity.repository';
import { TripRepository } from '../src/repositories/trip.repository';
import { ActivityService } from '../src/services/activity.service';
import { NotFoundError, ValidationError } from '../src/types/errors';
import { buildActivity } from './helpers/activity.factory';
import { buildTrip } from './helpers/trip.factory';

describe('ActivityService', () => {
  let activityRepository: jest.Mocked<ActivityRepository>;
  let tripRepository: jest.Mocked<TripRepository>;
  let activityService: ActivityService;

  const trip = buildTrip({
    id: 'trip-1',
    userId: 'user-1',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-10'),
  });

  const validPayload = {
    name: 'Red Beach',
    date: '2026-09-02',
    time: '14:30',
    location: 'Oia, Santorini',
    period: 'tarde',
    category: 'Praia',
    estimatedCost: 95,
    description: 'Almoço premiado e praia',
  };

  beforeEach(() => {
    activityRepository = {
      create: jest.fn(),
      findAllByTrip: jest.fn(),
      findByIdAndTrip: jest.fn(),
      findByTripDateAndTime: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<ActivityRepository>;

    tripRepository = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TripRepository>;

    activityService = new ActivityService(activityRepository, tripRepository);
  });

  describe('listActivities', () => {
    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(activityService.listActivities('trip-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(activityRepository.findAllByTrip).not.toHaveBeenCalled();
    });

    it('lista atividades da viagem quando o usuário é o dono', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const activities = [buildActivity()];
      activityRepository.findAllByTrip.mockResolvedValue(activities);

      const result = await activityService.listActivities('trip-1', 'user-1');

      expect(result).toEqual(activities);
    });
  });

  describe('createActivity', () => {
    it('cria atividade com dados válidos (RF12)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      activityRepository.create.mockResolvedValue(buildActivity());

      await activityService.createActivity('trip-1', 'user-1', validPayload);

      expect(activityRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({
          name: 'Red Beach',
          location: 'Oia, Santorini',
          period: 'tarde',
          category: 'Praia',
          estimatedCost: 95,
          description: 'Almoço premiado e praia',
        }),
      );
    });

    it('aceita payload apenas com nome, data e horário (fluxo alternativo RF12)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      activityRepository.create.mockResolvedValue(buildActivity());

      await activityService.createActivity('trip-1', 'user-1', {
        name: 'Fira – Centro Histórico',
        date: '2026-09-02',
      });

      expect(activityRepository.create).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({
          name: 'Fira – Centro Histórico',
          time: null,
          period: null,
          category: null,
          estimatedCost: null,
          description: null,
        }),
      );
    });

    it('lança ValidationError quando falta o nome (fluxo de exceção RF12)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        activityService.createActivity('trip-1', 'user-1', { ...validPayload, name: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(activityRepository.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando a data é anterior ao início da viagem (RN07)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        activityService.createActivity('trip-1', 'user-1', {
          ...validPayload,
          date: '2026-08-31',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(activityRepository.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando a data é posterior ao fim da viagem (RN07)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        activityService.createActivity('trip-1', 'user-1', {
          ...validPayload,
          date: '2026-09-11',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando o horário é inválido', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        activityService.createActivity('trip-1', 'user-1', { ...validPayload, time: '25:99' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando o período não é suportado', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        activityService.createActivity('trip-1', 'user-1', {
          ...validPayload,
          period: 'madrugada',
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança ValidationError quando o valor estimado é negativo', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);

      await expect(
        activityService.createActivity('trip-1', 'user-1', {
          ...validPayload,
          estimatedCost: -10,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        activityService.createActivity('trip-1', 'user-1', validPayload),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(activityRepository.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando já existe atividade no mesmo dia e horário', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      activityRepository.findByTripDateAndTime.mockResolvedValue(buildActivity());

      await expect(
        activityService.createActivity('trip-1', 'user-1', validPayload),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(activityRepository.create).not.toHaveBeenCalled();
    });

    it('permite duas atividades no mesmo dia em horários diferentes', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      activityRepository.findByTripDateAndTime.mockResolvedValue(null);
      activityRepository.create.mockResolvedValue(buildActivity());

      await activityService.createActivity('trip-1', 'user-1', validPayload);

      expect(activityRepository.create).toHaveBeenCalled();
    });

    it('não verifica conflito de horário quando a atividade não tem horário definido', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      activityRepository.create.mockResolvedValue(buildActivity());

      await activityService.createActivity('trip-1', 'user-1', {
        name: 'Fira – Centro Histórico',
        date: '2026-09-02',
      });

      expect(activityRepository.findByTripDateAndTime).not.toHaveBeenCalled();
      expect(activityRepository.create).toHaveBeenCalled();
    });
  });

  describe('deleteActivity', () => {
    it('exclui atividade quando a viagem pertence ao usuário', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      const activity = buildActivity();
      activityRepository.delete.mockResolvedValue(activity);

      const result = await activityService.deleteActivity('activity-1', 'trip-1', 'user-1');

      expect(result).toEqual(activity);
    });

    it('lança NotFoundError quando a atividade não existe na viagem', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(trip);
      activityRepository.delete.mockResolvedValue(null);

      await expect(
        activityService.deleteActivity('activity-1', 'trip-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
      tripRepository.findByIdAndUser.mockResolvedValue(null);

      await expect(
        activityService.deleteActivity('activity-1', 'trip-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(activityRepository.delete).not.toHaveBeenCalled();
    });
  });
});
