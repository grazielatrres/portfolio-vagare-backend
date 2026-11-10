import { Info, InfoType, Prisma } from '@prisma/client';
import { CreateInfoData, InfoRepository } from '../repositories/info.repository';
import { TripRepository } from '../repositories/trip.repository';
import { NotFoundError, ValidationError } from '../types/errors';

const TRIP_NOT_FOUND = 'Viagem não encontrada';
const INFO_NOT_FOUND = 'Informação não encontrada';
const SUPPORTED_TYPES: InfoType[] = ['flight', 'lodging', 'document'];

export interface InfoPayload {
  type: InfoType;
  title: string;
  description?: string | null;
  date?: string | null;
  details?: Record<string, unknown> | null;
}

export class InfoService {
  constructor(
    private readonly infoRepository: InfoRepository = new InfoRepository(),
    private readonly tripRepository: TripRepository = new TripRepository(),
  ) {}

  async listInfos(tripId: string, userId: string): Promise<Info[]> {
    await this.ensureTripAccess(tripId, userId);
    return this.infoRepository.findAllByTrip(tripId);
  }

  async createInfo(tripId: string, userId: string, data: InfoPayload): Promise<Info> {
    await this.ensureTripAccess(tripId, userId);
    const payload = this.validatePayload(data);
    return this.infoRepository.create(tripId, payload);
  }

  async updateInfo(id: string, tripId: string, userId: string, data: InfoPayload): Promise<Info> {
    await this.ensureTripAccess(tripId, userId);
    const payload = this.validatePayload(data);

    const info = await this.infoRepository.update(id, tripId, payload);
    if (!info) {
      throw new NotFoundError(INFO_NOT_FOUND);
    }
    return info;
  }

  async deleteInfo(id: string, tripId: string, userId: string): Promise<Info> {
    await this.ensureTripAccess(tripId, userId);
    const info = await this.infoRepository.delete(id, tripId);
    if (!info) {
      throw new NotFoundError(INFO_NOT_FOUND);
    }
    return info;
  }

  private async ensureTripAccess(tripId: string, userId: string) {
    const trip = await this.tripRepository.findByIdAndUser(tripId, userId);
    if (!trip) {
      throw new NotFoundError(TRIP_NOT_FOUND);
    }
    return trip;
  }

  // RF21-23/UC05: o cadastro é incremental — o usuário pode preencher só parte dos
  // campos e completar depois. O único campo sempre obrigatório é o título, que
  // identifica o registro na listagem agrupada por categoria (RF24).
  private validatePayload(data: InfoPayload): CreateInfoData {
    if (!SUPPORTED_TYPES.includes(data.type)) {
      throw new ValidationError('Tipo de informação inválido');
    }

    if (!this.hasText(data.title)) {
      throw new ValidationError('Nenhuma informação foi preenchida');
    }

    const date = this.parseDate(data.date);
    const details = this.normalizeDetails(data.details);

    return {
      type: data.type,
      title: data.title.trim(),
      description: this.normalizeText(data.description),
      date,
      details,
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

  private parseDate(value?: string | null): Date | null {
    if (!value || !value.trim()) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError('Data inválida');
    }
    return date;
  }

  private normalizeDetails(value?: Record<string, unknown> | null): Prisma.InputJsonValue | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError('Detalhes inválidos');
    }

    return Object.keys(value).length > 0 ? (value as Prisma.InputJsonValue) : null;
  }
}
