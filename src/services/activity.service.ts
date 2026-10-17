import { Activity } from '@prisma/client';
import { ActivityRepository, CreateActivityData } from '../repositories/activity.repository';
import { TripRepository } from '../repositories/trip.repository';
import { NotFoundError, ValidationError } from '../types/errors';

const TRIP_NOT_FOUND = 'Viagem não encontrada';
const ACTIVITY_NOT_FOUND = 'Atividade não encontrada';
const SUPPORTED_PERIODS = ['manha', 'tarde', 'noite'] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ActivityPayload {
  name: string;
  date: string;
  time?: string | null;
  location?: string | null;
  period?: string | null;
  category?: string | null;
  estimatedCost?: number | null;
  description?: string | null;
}

export class ActivityService {
  constructor(
    private readonly activityRepository: ActivityRepository = new ActivityRepository(),
    private readonly tripRepository: TripRepository = new TripRepository(),
  ) {}

  async listActivities(tripId: string, userId: string): Promise<Activity[]> {
    await this.ensureTripAccess(tripId, userId);
    return this.activityRepository.findAllByTrip(tripId);
  }

  async createActivity(tripId: string, userId: string, data: ActivityPayload): Promise<Activity> {
    const trip = await this.ensureTripAccess(tripId, userId);
    const payload = this.validatePayload(data, trip.startDate, trip.endDate);

    if (payload.time) {
      const conflict = await this.activityRepository.findByTripDateAndTime(
        tripId,
        payload.date,
        payload.time,
      );
      if (conflict) {
        throw new ValidationError('Já existe uma atividade cadastrada nesse horário');
      }
    }

    return this.activityRepository.create(tripId, payload);
  }

  async deleteActivity(id: string, tripId: string, userId: string): Promise<Activity> {
    await this.ensureTripAccess(tripId, userId);
    const activity = await this.activityRepository.delete(id, tripId);
    if (!activity) {
      throw new NotFoundError(ACTIVITY_NOT_FOUND);
    }
    return activity;
  }

  private async ensureTripAccess(tripId: string, userId: string) {
    const trip = await this.tripRepository.findByIdAndUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(TRIP_NOT_FOUND);
    }
    return trip;
  }

  private validatePayload(
    data: ActivityPayload,
    tripStartDate: Date,
    tripEndDate: Date,
  ): CreateActivityData {
    if (!this.hasText(data.name)) {
      throw new ValidationError('Nome é obrigatório');
    }

    const date = this.parseDate(data.date);

    if (date.getTime() < tripStartDate.getTime() || date.getTime() > tripEndDate.getTime()) {
      throw new ValidationError('A data da atividade deve estar dentro do período da viagem');
    }

    const time = this.parseTime(data.time);

    const period = data.period ? data.period.toLowerCase() : null;
    if (
      period !== null &&
      !SUPPORTED_PERIODS.includes(period as (typeof SUPPORTED_PERIODS)[number])
    ) {
      throw new ValidationError('Período inválido');
    }

    if (data.estimatedCost !== undefined && data.estimatedCost !== null && data.estimatedCost < 0) {
      throw new ValidationError('Valor estimado não pode ser negativo');
    }

    return {
      name: data.name.trim(),
      date,
      time,
      location: this.normalizeText(data.location),
      period,
      category: this.normalizeText(data.category),
      estimatedCost: data.estimatedCost ?? null,
      description: this.normalizeText(data.description),
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

  private parseDate(value: string): Date {
    if (!this.hasText(value)) {
      throw new ValidationError('Data é obrigatória');
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError('Data inválida');
    }

    return date;
  }

  private parseTime(value?: string | null): Date | null {
    if (!value || !value.trim()) {
      return null;
    }

    const match = TIME_PATTERN.exec(value.trim());
    if (!match) {
      throw new ValidationError('Horário inválido. Use o formato HH:mm');
    }

    const [, hours, minutes] = match;
    return new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes), 0));
  }
}
