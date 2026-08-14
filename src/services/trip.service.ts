import { Trip } from '@prisma/client';
import { CreateTripData, TripRepository } from '../repositories/trip.repository';
import { NotFoundError, ValidationError } from '../types/errors';

const TRIP_NOT_FOUND = 'Viagem não encontrada';

export interface TripPayload {
  name: string;
  destination: string;
  startDate: Date | string;
  endDate: Date | string;
  budget?: number | null;
  numberOfPeople?: number | null;
}

export class TripService {
  constructor(private readonly tripRepository: TripRepository = new TripRepository()) {}

  async createTrip(userId: string, data: TripPayload): Promise<Trip> {
    return this.tripRepository.create(userId, this.validateTripPayload(data));
  }

  async listTrips(userId: string): Promise<Trip[]> {
    return this.tripRepository.findAllByUser(userId);
  }

  async getTrip(id: string, userId: string): Promise<Trip> {
    return this.ensureFound(await this.tripRepository.findByIdAndUser(id, userId));
  }

  async updateTrip(id: string, userId: string, data: TripPayload): Promise<Trip> {
    return this.ensureFound(
      await this.tripRepository.update(id, userId, this.validateTripPayload(data)),
    );
  }

  async deleteTrip(id: string, userId: string): Promise<Trip> {
    return this.ensureFound(await this.tripRepository.delete(id, userId));
  }

  private validateTripPayload(data: TripPayload): CreateTripData {
    if (!this.hasText(data.name)) {
      throw new ValidationError('Nome é obrigatório');
    }
    if (!this.hasText(data.destination)) {
      throw new ValidationError('Destino é obrigatório');
    }

    const startDate = this.parseDate(data.startDate, 'Data de início');
    const endDate = this.parseDate(data.endDate, 'Data de término');

    if (endDate.getTime() < startDate.getTime()) {
      throw new ValidationError('A data de término deve ser igual ou posterior à data de início');
    }

    return {
      name: data.name.trim(),
      destination: data.destination.trim(),
      startDate,
      endDate,
      budget: data.budget ?? null,
      numberOfPeople: data.numberOfPeople ?? null,
    };
  }

  private ensureFound(trip: Trip | null): Trip {
    if (!trip) {
      throw new NotFoundError(TRIP_NOT_FOUND);
    }
    return trip;
  }

  private hasText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private parseDate(value: Date | string | undefined, fieldLabel: string): Date {
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`${fieldLabel} é obrigatória`);
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError(`${fieldLabel} inválida`);
    }

    return date;
  }
}
