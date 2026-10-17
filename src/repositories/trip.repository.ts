import { Prisma, Trip } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateTripData {
  name: string;
  destination: string;
  latitude?: Prisma.Decimal | number | null;
  longitude?: Prisma.Decimal | number | null;
  startDate: Date;
  endDate: Date;
  budget?: Prisma.Decimal | number | null;
  currency: string;
  numberOfPeople?: number | null;
}

export type UpdateTripData = Partial<CreateTripData>;

export class TripRepository {
  async create(userId: string, data: CreateTripData): Promise<Trip> {
    return prisma.trip.create({
      data: {
        userId,
        name: data.name,
        destination: data.destination,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        budget: data.budget ?? null,
        currency: data.currency,
        numberOfPeople: data.numberOfPeople ?? null,
      },
    });
  }

  async findAllByUser(userId: string): Promise<Trip[]> {
    return prisma.trip.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
    });
  }

  async countByUser(userId: string): Promise<number> {
    return prisma.trip.count({ where: { userId } });
  }

  async findByIdAndUser(id: string, userId: string): Promise<Trip | null> {
    return prisma.trip.findFirst({
      where: { id, userId },
    });
  }

  async update(id: string, userId: string, data: UpdateTripData): Promise<Trip | null> {
    const existing = await this.findByIdAndUser(id, userId);
    if (!existing) {
      return null;
    }

    return prisma.trip.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.destination !== undefined && { destination: data.destination }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.budget !== undefined && { budget: data.budget }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.numberOfPeople !== undefined && { numberOfPeople: data.numberOfPeople }),
      },
    });
  }

  async delete(id: string, userId: string): Promise<Trip | null> {
    const existing = await this.findByIdAndUser(id, userId);
    if (!existing) {
      return null;
    }

    return prisma.trip.delete({
      where: { id },
    });
  }
}
