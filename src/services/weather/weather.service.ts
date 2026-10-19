import { Trip } from '@prisma/client';
import { TripRepository } from '../../repositories/trip.repository';
import { NotFoundError } from '../../types/errors';
import { OpenWeatherForecastEntry, WeatherClient } from './weather.client';

const TRIP_NOT_FOUND = 'Viagem não encontrada';

export interface DailyForecast {
  date: string;
  temperature: number;
  condition: string;
  icon: string;
}

export class WeatherService {
  constructor(
    private readonly weatherClient: WeatherClient = new WeatherClient(),
    private readonly tripRepository: TripRepository = new TripRepository(),
  ) {}

  async getTripForecast(tripId: string, userId: string): Promise<DailyForecast[]> {
    const trip = await this.ensureTripAccess(tripId, userId);
    const coordinates =
      trip.latitude !== null && trip.longitude !== null
        ? { latitude: Number(trip.latitude), longitude: Number(trip.longitude) }
        : null;
    const entries = await this.weatherClient.getForecast(trip.destination, coordinates);
    return this.groupByDay(entries, trip.startDate, trip.endDate);
  }

  private async ensureTripAccess(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.tripRepository.findByIdAndUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(TRIP_NOT_FOUND);
    }
    return trip;
  }

  private groupByDay(
    entries: OpenWeatherForecastEntry[],
    tripStartDate: Date,
    tripEndDate: Date,
  ): DailyForecast[] {
    const byDate = new Map<string, OpenWeatherForecastEntry[]>();

    for (const entry of entries) {
      const dateKey = entry.dt_txt.slice(0, 10);
      const dayEntries = byDate.get(dateKey) ?? [];
      dayEntries.push(entry);
      byDate.set(dateKey, dayEntries);
    }

    const days: DailyForecast[] = [];

    for (const [dateKey, dayEntries] of byDate) {
      const date = new Date(dateKey);
      if (date.getTime() < tripStartDate.getTime() || date.getTime() > tripEndDate.getTime()) {
        continue;
      }

      // A API gratuita retorna previsão em blocos de 3h; usamos o horário mais
      // próximo do meio-dia como amostra representativa do dia.
      const representative = dayEntries.reduce((closest, entry) =>
        this.hourDistanceFromNoon(entry) < this.hourDistanceFromNoon(closest) ? entry : closest,
      );

      days.push({
        date: dateKey,
        temperature: Math.round(representative.main.temp),
        condition: representative.weather[0]?.description ?? '',
        icon: representative.weather[0]?.icon ?? '',
      });
    }

    return days.sort((a, b) => a.date.localeCompare(b.date));
  }

  private hourDistanceFromNoon(entry: OpenWeatherForecastEntry): number {
    const hour = Number(entry.dt_txt.slice(11, 13));
    return Math.abs(hour - 12);
  }
}
