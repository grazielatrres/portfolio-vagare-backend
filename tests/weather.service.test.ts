// weather.service.test.ts — RF16, RN01, RN08

import { Prisma } from '@prisma/client';
import { TripRepository } from '../src/repositories/trip.repository';
import { OpenWeatherForecastEntry, WeatherClient } from '../src/services/weather/weather.client';
import { WeatherService } from '../src/services/weather/weather.service';
import { AppError, NotFoundError } from '../src/types/errors';
import { buildTrip } from './helpers/trip.factory';

function buildEntry(overrides: Partial<OpenWeatherForecastEntry> = {}): OpenWeatherForecastEntry {
  return {
    dt_txt: '2026-09-02 12:00:00',
    main: { temp: 24.3 },
    weather: [{ description: 'céu limpo', icon: '01d' }],
    ...overrides,
  };
}

describe('WeatherService', () => {
  let weatherClient: jest.Mocked<WeatherClient>;
  let tripRepository: jest.Mocked<TripRepository>;
  let weatherService: WeatherService;

  const trip = buildTrip({
    id: 'trip-1',
    userId: 'user-1',
    destination: 'Santorini, Grécia',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-10'),
  });

  beforeEach(() => {
    weatherClient = { getForecast: jest.fn() } as unknown as jest.Mocked<WeatherClient>;
    tripRepository = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdAndUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<TripRepository>;

    weatherService = new WeatherService(weatherClient, tripRepository);
  });

  it('lança NotFoundError quando a viagem não pertence ao usuário (RN01)', async () => {
    tripRepository.findByIdAndUser.mockResolvedValue(null);

    await expect(weatherService.getTripForecast('trip-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(weatherClient.getForecast).not.toHaveBeenCalled();
  });

  it('consulta a previsão usando o destino da viagem quando não há coordenadas', async () => {
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    weatherClient.getForecast.mockResolvedValue([]);

    await weatherService.getTripForecast('trip-1', 'user-1');

    expect(weatherClient.getForecast).toHaveBeenCalledWith('Santorini, Grécia', null);
  });

  it('consulta a previsão por coordenadas quando a viagem já foi geocodificada', async () => {
    const tripWithCoordinates = buildTrip({
      ...trip,
      latitude: new Prisma.Decimal('36.4071'),
      longitude: new Prisma.Decimal('25.4566'),
    });
    tripRepository.findByIdAndUser.mockResolvedValue(tripWithCoordinates);
    weatherClient.getForecast.mockResolvedValue([]);

    await weatherService.getTripForecast('trip-1', 'user-1');

    expect(weatherClient.getForecast).toHaveBeenCalledWith('Santorini, Grécia', {
      latitude: 36.4071,
      longitude: 25.4566,
    });
  });

  it('agrupa a previsão por dia dentro do período da viagem (RF16)', async () => {
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    weatherClient.getForecast.mockResolvedValue([
      buildEntry({ dt_txt: '2026-09-02 09:00:00', main: { temp: 20 } }),
      buildEntry({ dt_txt: '2026-09-02 12:00:00', main: { temp: 24 } }),
      buildEntry({ dt_txt: '2026-09-02 15:00:00', main: { temp: 23 } }),
      buildEntry({
        dt_txt: '2026-09-03 12:00:00',
        main: { temp: 19 },
        weather: [{ description: 'chuva', icon: '10d' }],
      }),
    ]);

    const result = await weatherService.getTripForecast('trip-1', 'user-1');

    expect(result).toEqual([
      { date: '2026-09-02', temperature: 24, condition: 'céu limpo', icon: '01d' },
      { date: '2026-09-03', temperature: 19, condition: 'chuva', icon: '10d' },
    ]);
  });

  it('escolhe o horário mais próximo do meio-dia como amostra do dia', async () => {
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    weatherClient.getForecast.mockResolvedValue([
      buildEntry({ dt_txt: '2026-09-02 06:00:00', main: { temp: 15 } }),
      buildEntry({ dt_txt: '2026-09-02 13:00:00', main: { temp: 26 } }),
      buildEntry({ dt_txt: '2026-09-02 21:00:00', main: { temp: 18 } }),
    ]);

    const result = await weatherService.getTripForecast('trip-1', 'user-1');

    expect(result[0].temperature).toBe(26);
  });

  it('descarta previsões fora do período da viagem', async () => {
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    weatherClient.getForecast.mockResolvedValue([
      buildEntry({ dt_txt: '2026-08-31 12:00:00' }),
      buildEntry({ dt_txt: '2026-09-11 12:00:00' }),
    ]);

    const result = await weatherService.getTripForecast('trip-1', 'user-1');

    expect(result).toEqual([]);
  });

  it('propaga o erro padronizado quando a API externa está indisponível (RN08)', async () => {
    tripRepository.findByIdAndUser.mockResolvedValue(trip);
    weatherClient.getForecast.mockRejectedValue(
      new AppError('Previsão do tempo indisponível no momento', 503),
    );

    await expect(weatherService.getTripForecast('trip-1', 'user-1')).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
